module splitsui::multi_send {
    // Import specific functions instead of whole modules
    use sui::transfer::public_transfer;
    use sui::coin::{Self, Coin};
    use sui::tx_context::sender;
    use sui::tx_context::TxContext;
    use sui::event;

    /// Error codes
    const EInsufficientBalance: u64 = 0;
    const EInvalidRecipientCount: u64 = 1;
    const EInvalidAmountCount: u64 = 2;

    /// Event emitted when tokens are multi-sent
    public struct MultiSendEvent has copy, drop {
        sender: address,
        recipients_count: u64,
        total_amount: u64,
    }

    /// Batch sends tokens to multiple recipients in a single transaction
    /// recipients and amounts must have the same length
    public fun multi_send<T>(
        coin: &mut Coin<T>,
        recipients: vector<address>,
        amounts: vector<u64>,
        ctx: &mut TxContext
    ) {
        let recipients_len = vector::length(&recipients);
        let amounts_len = vector::length(&amounts);
        
        // Validate input
        assert!(recipients_len > 0, EInvalidRecipientCount);
        assert!(recipients_len == amounts_len, EInvalidAmountCount);
        
        let mut total_amount = 0u64;
        let mut i = 0;
        while (i < amounts_len) {
            total_amount = total_amount + *vector::borrow(&amounts, i);
            i = i + 1;
        };
        
        // Check if sufficient balance exists
        let balance_value = coin::value(coin);
        assert!(balance_value >= total_amount, EInsufficientBalance);
        
        // Process each recipient
        let mut i = 0;
        while (i < recipients_len) {
            let recipient = *vector::borrow(&recipients, i);
            let amount = *vector::borrow(&amounts, i);
            
            // Create and send the split coin
            let split_coin = coin::split(coin, amount, ctx);
            public_transfer(split_coin, recipient);
            
            i = i + 1;
        };
        
        // Emit event
        event::emit(MultiSendEvent {
            sender: sender(ctx),
            recipients_count: recipients_len,
            total_amount,
        });
    }
}