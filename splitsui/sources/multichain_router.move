#[allow(duplicate_alias)]
module splitsui::multichain_router {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::transfer::share_object;
    use std::vector;
    
    // Pyth Network integration for real-time price feeds
    // Note: These imports assume Pyth is properly configured in Move.toml
    // You may need to adjust the module paths based on your Pyth package version
    // use pyth::price::{Price, PriceInfoObject};
    // use pyth::price_identifier::{from_byte_vec};
    // use pyth::pyth::{get_price};
    
    // Import existing modules
    use splitsui::multi_send;
    use splitsui::group_payment;

    /// Chain IDs
    const CHAIN_SUI: u8 = 1;
    const CHAIN_ETH: u8 = 2;
    const CHAIN_POLYGON: u8 = 3;
    const CHAIN_BSC: u8 = 4;

    /// Error codes
    const EUnsupportedChain: u64 = 100;
    const EInvalidChainCount: u64 = 101;
    const EInsufficientBalance: u64 = 102;
    const EPriceConversionFailed: u64 = 103;

    /// Simplified Price oracle struct without Pyth integration (for now)
    /// Once Pyth is properly configured, you can uncomment the Pyth-related fields
    public struct PriceOracle has key, store {
        id: UID,
        // Pyth price feed IDs (uncomment when Pyth is available)
        // sui_usd_feed_id: vector<u8>,
        // eth_usd_feed_id: vector<u8>,
        // matic_usd_feed_id: vector<u8>,
        // bnb_usd_feed_id: vector<u8>,
        
        // Exchange rates (fallback approach)
        sui_to_eth_rate: u64,
        sui_to_matic_rate: u64,
        sui_to_bnb_rate: u64,
        last_updated: u64,
        // use_pyth: bool, // Toggle between Pyth and fallback
    }

    /// Wormhole bridge request
    public struct BridgeRequest has key, store {
        id: UID,
        source_chain: u8,
        target_chain: u8,
        recipient: address,
        amount: u64,
        original_sender: address,
        request_type: u8, // 1=multi_send, 2=group_payment
    }

    /// Events
    public struct MultichainMultiSendEvent has copy, drop {
        sender: address,
        total_recipients: u64,
        sui_recipients: u64,
        bridge_recipients: u64,
        total_sui_amount: u64,
        chains_used: vector<u8>,
    }

    public struct MultichainGroupPaymentEvent has copy, drop {
        request_id: address,
        creator: address,
        total_contributors: u64,
        cross_chain_contributors: u64,
        total_amount_sui: u64,
        supported_chains: vector<u8>,
    }

    public struct BridgeInitiatedEvent has copy, drop {
        bridge_id: address,
        source_chain: u8,
        target_chain: u8,
        amount: u64,
        recipient: address,
    }

    /// Initialize price oracle with fallback rates
    public fun init_price_oracle(ctx: &mut TxContext) {
        let oracle = PriceOracle {
            id: object::new(ctx),
            // Exchange rates (these should be updated regularly)
            sui_to_eth_rate: 1500000000000000, // 1 SUI = 0.0015 ETH (adjust as needed)
            sui_to_matic_rate: 2000000000000000000, // 1 SUI = 2 MATIC (adjust as needed)
            sui_to_bnb_rate: 5000000000000000, // 1 SUI = 0.005 BNB (adjust as needed)
            last_updated: tx_context::epoch(ctx),
        };
        share_object(oracle);
    }

    /// Update exchange rates
    public fun update_oracle_settings(
        oracle: &mut PriceOracle,
        sui_to_eth: u64,
        sui_to_matic: u64,
        sui_to_bnb: u64,
        ctx: &mut TxContext
    ) {
        oracle.sui_to_eth_rate = sui_to_eth;
        oracle.sui_to_matic_rate = sui_to_matic;
        oracle.sui_to_bnb_rate = sui_to_bnb;
        oracle.last_updated = tx_context::epoch(ctx);
    }

    /// Multichain multi-send entry point (simplified without Pyth for now)
    public entry fun multichain_multi_send(
        coin: &mut Coin<SUI>,
        recipients: vector<address>,
        amounts: vector<u64>,
        chains: vector<u8>,
        oracle: &PriceOracle,
        ctx: &mut TxContext
    ) {
        let recipients_len = vector::length(&recipients);
        let amounts_len = vector::length(&amounts);
        let chains_len = vector::length(&chains);

        // Validate inputs
        assert!(recipients_len == amounts_len, EInvalidChainCount);
        assert!(recipients_len == chains_len, EInvalidChainCount);

        // Separate Sui and cross-chain recipients
        let mut sui_recipients = vector::empty<address>();
        let mut sui_amounts = vector::empty<u64>();
        let mut bridge_count = 0;
        let mut total_sui_needed = 0;
        let mut chains_used = vector::empty<u8>();

        let mut i = 0;
        while (i < recipients_len) {
            let recipient = *vector::borrow(&recipients, i);
            let amount = *vector::borrow(&amounts, i);
            let chain = *vector::borrow(&chains, i);

            // Validate chain
            assert!(is_supported_chain(chain), EUnsupportedChain);

            if (chain == CHAIN_SUI) {
                // Direct SUI transfer
                vector::push_back(&mut sui_recipients, recipient);
                vector::push_back(&mut sui_amounts, amount);
                total_sui_needed = total_sui_needed + amount;
            } else {
                // Cross-chain transfer
                let sui_equivalent = convert_to_sui_amount(amount, chain, oracle);
                total_sui_needed = total_sui_needed + sui_equivalent;
                
                // Create bridge request
                create_bridge_request(
                    CHAIN_SUI,
                    chain,
                    recipient,
                    amount,
                    tx_context::sender(ctx),
                    1, // multi_send type
                    ctx
                );
                
                bridge_count = bridge_count + 1;
            };

            // Track unique chains used
            if (!vector::contains(&chains_used, &chain)) {
                vector::push_back(&mut chains_used, chain);
            };

            i = i + 1;
        };

        // Check sufficient balance
        assert!(coin::value(coin) >= total_sui_needed, EInsufficientBalance);

        // Process Sui recipients using existing contract
        if (vector::length(&sui_recipients) > 0) {
            multi_send::multi_send(coin, sui_recipients, sui_amounts, ctx);
        };

        // Emit event
        event::emit(MultichainMultiSendEvent {
            sender: tx_context::sender(ctx),
            total_recipients: recipients_len,
            sui_recipients: vector::length(&sui_recipients),
            bridge_recipients: bridge_count,
            total_sui_amount: total_sui_needed,
            chains_used,
        });
    }

    /// Create multichain group payment (simplified without Pyth)
    public entry fun create_multichain_group_payment(
        payers: vector<address>,
        amounts: vector<u64>,
        chains: vector<u8>,
        recipient: address,
        description: vector<u8>,
        oracle: &PriceOracle,
        ctx: &mut TxContext
    ) {
        let payers_len = vector::length(&payers);
        let amounts_len = vector::length(&amounts);
        let chains_len = vector::length(&chains);

        // Validate inputs
        assert!(payers_len == amounts_len, EInvalidChainCount);
        assert!(payers_len == chains_len, EInvalidChainCount);

        // Convert all amounts to SUI equivalent for the group payment contract
        let mut sui_amounts = vector::empty<u64>();
        let mut cross_chain_count = 0;
        let mut total_sui_amount = 0;
        let mut unique_chains = vector::empty<u8>();

        let mut i = 0;
        while (i < payers_len) {
            let amount = *vector::borrow(&amounts, i);
            let chain = *vector::borrow(&chains, i);

            // Validate chain
            assert!(is_supported_chain(chain), EUnsupportedChain);

            let sui_equivalent = if (chain == CHAIN_SUI) {
                amount
            } else {
                cross_chain_count = cross_chain_count + 1;
                convert_to_sui_amount(amount, chain, oracle)
            };

            vector::push_back(&mut sui_amounts, sui_equivalent);
            total_sui_amount = total_sui_amount + sui_equivalent;

            // Track unique chains
            if (!vector::contains(&unique_chains, &chain)) {
                vector::push_back(&mut unique_chains, chain);
            };

            i = i + 1;
        };

        // Create standard group payment with SUI amounts
        group_payment::create_group_payment<SUI>(
            payers,
            sui_amounts,
            recipient,
            description,
            ctx
        );

        // Emit multichain event
        event::emit(MultichainGroupPaymentEvent {
            request_id: recipient, // Simplified - in real implementation, get actual request ID
            creator: tx_context::sender(ctx),
            total_contributors: payers_len,
            cross_chain_contributors: cross_chain_count,
            total_amount_sui: total_sui_amount,
            supported_chains: unique_chains,
        });
    }

    /// Contribute to group payment from any chain (simplified)
    public entry fun multichain_contribute(
        _request: &mut group_payment::GroupPaymentRequest<SUI>,
        payment_amount: u64,
        source_chain: u8,
        oracle: &PriceOracle,
        ctx: &mut TxContext
    ) {
        // Validate chain
        assert!(is_supported_chain(source_chain), EUnsupportedChain);

        if (source_chain == CHAIN_SUI) {
            // Direct SUI contribution - user must provide Coin<SUI> separately
            // This is a placeholder - in practice, you'd need the actual coin
            // group_payment::contribute(request, sui_coin, ctx);
        } else {
            // Cross-chain contribution
            let sui_equivalent = convert_to_sui_amount(payment_amount, source_chain, oracle);
            
            // Create bridge request for contribution
            create_bridge_request(
                source_chain,
                CHAIN_SUI,
                tx_context::sender(ctx), // Will be processed when bridge completes
                sui_equivalent,
                tx_context::sender(ctx),
                2, // group_payment type
                ctx
            );
        };
    }

    // === Helper Functions ===

    /// Check if chain is supported
    fun is_supported_chain(chain: u8): bool {
        chain == CHAIN_SUI || chain == CHAIN_ETH || chain == CHAIN_POLYGON || chain == CHAIN_BSC
    }

    /// Convert amount from target chain to SUI equivalent using fixed rates
    fun convert_to_sui_amount(
        amount: u64, 
        chain: u8, 
        oracle: &PriceOracle,
    ): u64 {
        if (chain == CHAIN_SUI) {
            return amount
        };

        // Convert based on exchange rates
        if (chain == CHAIN_ETH) {
            amount / oracle.sui_to_eth_rate
        } else if (chain == CHAIN_POLYGON) {
            amount / oracle.sui_to_matic_rate
        } else if (chain == CHAIN_BSC) {
            amount / oracle.sui_to_bnb_rate
        } else {
            abort EPriceConversionFailed
        }
    }

    /// Convert SUI amount to target chain amount
    #[allow(unused_function)]
    fun convert_from_sui_amount(sui_amount: u64, chain: u8, oracle: &PriceOracle): u64 {
        if (chain == CHAIN_SUI) {
            return sui_amount
        };

        // Convert based on exchange rates
        if (chain == CHAIN_ETH) {
            sui_amount * oracle.sui_to_eth_rate
        } else if (chain == CHAIN_POLYGON) {
            sui_amount * oracle.sui_to_matic_rate
        } else if (chain == CHAIN_BSC) {
            sui_amount * oracle.sui_to_bnb_rate
        } else {
            abort EPriceConversionFailed
        }
    }

    /// Create bridge request (placeholder for Wormhole integration)
    fun create_bridge_request(
        source_chain: u8,
        target_chain: u8,
        recipient: address,
        amount: u64,
        sender: address,
        request_type: u8,
        ctx: &mut TxContext
    ) {
        let bridge_request = BridgeRequest {
            id: object::new(ctx),
            source_chain,
            target_chain,
            recipient,
            amount,
            original_sender: sender,
            request_type,
        };

        let bridge_id = object::uid_to_address(&bridge_request.id);

        // Emit bridge event
        event::emit(BridgeInitiatedEvent {
            bridge_id,
            source_chain,
            target_chain,
            amount,
            recipient,
        });

        // Share for processing (in real implementation, this would trigger Wormhole)
        share_object(bridge_request);
    }

    // === View Functions ===

    /// Get current exchange rates
    public fun get_exchange_rates(oracle: &PriceOracle): (u64, u64, u64, u64) {
        (
            oracle.sui_to_eth_rate,
            oracle.sui_to_matic_rate,
            oracle.sui_to_bnb_rate,
            oracle.last_updated
        )
    }

    /// Get supported chains
    public fun get_supported_chains(): vector<u8> {
        vector[CHAIN_SUI, CHAIN_ETH, CHAIN_POLYGON, CHAIN_BSC]
    }

    /// Calculate required SUI for multichain multi-send
    public fun calculate_total_sui_needed(
        amounts: vector<u64>,
        chains: vector<u8>,
        oracle: &PriceOracle
    ): u64 {
        let mut total = 0;
        let mut i = 0;
        while (i < vector::length(&amounts)) {
            let amount = *vector::borrow(&amounts, i);
            let chain = *vector::borrow(&chains, i);
            let sui_equivalent = convert_to_sui_amount(amount, chain, oracle);
            total = total + sui_equivalent;
            i = i + 1;
        };
        total
    }
}