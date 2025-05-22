#[allow(duplicate_alias)]
module splitsui::group_payment {
    // Only import what we need without aliases
    use sui::object::new as obj_new;
    use sui::object::uid_to_address;
    use sui::transfer::share_object;
    use sui::transfer::public_transfer;
    use sui::tx_context::sender;
    use sui::tx_context::epoch;
    use sui::tx_context::TxContext;
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::vec_map::{Self, VecMap};
    
    // UID is imported directly from the struct definition
    public struct GroupPaymentRequest<phantom T> has key, store {
        id: sui::object::UID,
        payers: vector<address>,
        amounts: vector<u64>,
        contributions: VecMap<address, Coin<T>>,
        recipient: address,
        description: vector<u8>,
        created_at: u64,
        complete: bool,
        creator: address,
    }

    /// Error codes
    const EInvalidPayerCount: u64 = 0;
    const EInvalidAmountCount: u64 = 1;
    const EUnauthorizedContributor: u64 = 3;
    const EAlreadyContributed: u64 = 4;
    const EInsufficientAmount: u64 = 5;
    const EUnauthorizedRecipient: u64 = 6;
    const EPaymentNotComplete: u64 = 7;
    const ENoContributions: u64 = 8;
    const EUnauthorizedCancel: u64 = 9;

    /// Event emitted when a new group payment request is created
    public struct GroupPaymentCreatedEvent has copy, drop {
        request_id: address,
        payers_count: u64,
        total_amount: u64,
        recipient: address,
        creator: address,
    }

    /// Event emitted when someone contributes to a group payment
    public struct ContributionEvent has copy, drop {
        request_id: address,
        contributor: address,
        amount: u64,
    }

    /// Event emitted when payment is released to recipient
    public struct PaymentReleasedEvent has copy, drop {
        request_id: address,
        recipient: address,
        total_amount: u64,
    }

    /// Event emitted when payment is cancelled and refunded
    public struct PaymentCancelledEvent has copy, drop {
        request_id: address,
        refund_count: u64,
    }

    /// Create a new group payment request
    public fun create_group_payment<T>(
        payers: vector<address>,
        amounts: vector<u64>,
        recipient: address,
        description: vector<u8>,
        ctx: &mut TxContext
    ) {
        let payers_len = vector::length(&payers);
        let amounts_len = vector::length(&amounts);

        // Validate input
        assert!(payers_len > 0, EInvalidPayerCount);
        assert!(payers_len == amounts_len, EInvalidAmountCount);

        // Calculate total amount
        let mut total_amount = 0u64;
        let mut i = 0;
        while (i < amounts_len) {
            total_amount = total_amount + *vector::borrow(&amounts, i);
            i = i + 1;
        };

        // Create payment request
        let request = GroupPaymentRequest<T> {
            id: obj_new(ctx),
            payers,
            amounts,
            contributions: vec_map::empty<address, Coin<T>>(),
            recipient,
            description,
            created_at: epoch(ctx),
            complete: false,
            creator: sender(ctx),
        };

        let request_id = uid_to_address(&request.id);

        // Emit event
        event::emit(GroupPaymentCreatedEvent {
            request_id,
            payers_count: payers_len,
            total_amount,
            recipient,
            creator: sender(ctx),
        });

        // Share the object
        share_object(request);
    }

    /// Contribute to a group payment request
    #[allow(lint(self_transfer))]
    public fun contribute<T>(
        request: &mut GroupPaymentRequest<T>,
        mut payment: Coin<T>,
        ctx: &mut TxContext
    ) {
        let sender = sender(ctx);
        
        // Check if user is authorized to contribute
        let (payer_index, is_valid_payer) = find_payer_index(&request.payers, sender);
        assert!(is_valid_payer, EUnauthorizedContributor);
        
        // Check if user has already contributed
        assert!(!vec_map::contains(&request.contributions, &sender), EAlreadyContributed);
        
        // Check if amount is correct
        let expected_amount = *vector::borrow(&request.amounts, payer_index);
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= expected_amount, EInsufficientAmount);
        
        // Split exact amount if needed
        if (payment_amount > expected_amount) {
            let remainder = coin::split(&mut payment, payment_amount - expected_amount, ctx);
            // We're suppressing the non-composable transfer warning with the attribute above
            public_transfer(remainder, sender);
        };
        
        // Store contribution
        vec_map::insert(&mut request.contributions, sender, payment);
        
        // Emit event
        event::emit(ContributionEvent {
            request_id: uid_to_address(&request.id),
            contributor: sender,
            amount: expected_amount,
        });
        
        // Check if all payments received and auto-release if complete
        check_completion_and_release(request, ctx);
    }

    /// Manually release the payment
    public fun manual_release<T>(
        request: &mut GroupPaymentRequest<T>,
        ctx: &mut TxContext
    ) {
        let sender = sender(ctx);
        
        // Only recipient can manually release
        assert!(sender == request.recipient, EUnauthorizedRecipient);
        
        // Release payment
        release_payment(request, ctx);
    }

    /// Cancel and refund all contributions
    public fun cancel_and_refund<T>(
        request: &mut GroupPaymentRequest<T>,
        ctx: &mut TxContext
    ) {
        let sender = sender(ctx);
        
        // Only creator can cancel
        assert!(sender == request.creator, EUnauthorizedCancel);
        
        // Ensure not already completed
        assert!(!request.complete, EPaymentNotComplete);
        
        // Refund all contributions
        let contributors = vec_map::keys(&request.contributions);
        let refund_count = vector::length(&contributors);
        
        assert!(refund_count > 0, ENoContributions);
        
        let mut i = 0;
        while (i < refund_count) {
            let contributor = *vector::borrow(&contributors, i);
            let (_, contribution) = vec_map::remove(&mut request.contributions, &contributor);
            public_transfer(contribution, contributor);
            i = i + 1;
        };
        
        // Mark as complete to prevent further contributions
        request.complete = true;
        
        // Emit cancel event
        event::emit(PaymentCancelledEvent {
            request_id: uid_to_address(&request.id),
            refund_count,
        });
    }

    // --- Helper functions ---

    /// Find the index of a payer in the payers list
    fun find_payer_index(payers: &vector<address>, payer: address): (u64, bool) {
        let len = vector::length(payers);
        let mut i = 0;
        
        while (i < len) {
            if (*vector::borrow(payers, i) == payer) {
                return (i, true)
            };
            i = i + 1;
        };
        
        (0, false)
    }

    /// Check if all payments received and release if complete
    fun check_completion_and_release<T>(
        request: &mut GroupPaymentRequest<T>,
        ctx: &mut TxContext
    ) {
        if (request.complete) return;
        
        let contributors = vec_map::keys(&request.contributions);
        let total_contributed = vector::length(&contributors);
        let total_payers = vector::length(&request.payers);
        
        if (total_contributed == total_payers) {
            release_payment(request, ctx);
        }
    }

    /// Release payment to recipient
    #[allow(unused_variable, unused_mut_parameter)]
    fun release_payment<T>(
        request: &mut GroupPaymentRequest<T>,
        _ctx: &mut TxContext  // Renamed to _ctx as it's unused
    ) {
        // Ensure not already completed
        assert!(!request.complete, EPaymentNotComplete);
        
        // Merge all contributions
        let contributors = vec_map::keys(&request.contributions);
        let total_contributors = vector::length(&contributors);
        
        assert!(total_contributors > 0, ENoContributions);
        
        // Take the first contribution as base
        let first_contributor = *vector::borrow(&contributors, 0);
        let (_, mut merged_payment) = vec_map::remove(&mut request.contributions, &first_contributor);
        
        // Merge all other contributions
        let mut i = 1;
        while (i < total_contributors) {
            let contributor = *vector::borrow(&contributors, i);
            let (_, payment) = vec_map::remove(&mut request.contributions, &contributor);
            coin::join(&mut merged_payment, payment);
            i = i + 1;
        };
        
        // Mark request as complete
        request.complete = true;
        
        // Determine total amount
        let total_amount = coin::value(&merged_payment);
        
        // Emit release event
        event::emit(PaymentReleasedEvent {
            request_id: uid_to_address(&request.id),
            recipient: request.recipient,
            total_amount,
        });
        
        // Transfer to recipient
        public_transfer(merged_payment, request.recipient);
    }
}