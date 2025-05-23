module splitsui::group_payment {
    // Only import what we need without aliases
    use sui::object::new as obj_new;
    use sui::object::uid_to_address;
    use sui::transfer::share_object;
    use sui::transfer::public_transfer;
    use sui::tx_context::sender;
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::vec_map::{Self, VecMap};
    
    // Main struct with public visibility
    public struct GroupPaymentRequest<phantom T> has key, store {
        id: sui::object::UID,
        payers: vector<address>,
        amounts: vector<u64>,
        paid_status: VecMap<address, bool>, // Track who has paid
        recipient: address,
        description: vector<u8>,
        created_at: u64,
        creator: address,
        total_amount: u64,
        total_collected: u64, // Track total amount collected so far
    }

    /// Error codes
    const EInvalidPayerCount: u64 = 0;
    const EInvalidAmountCount: u64 = 1;
    const EUnauthorizedContributor: u64 = 3;
    const EAlreadyContributed: u64 = 4;
    const EInsufficientAmount: u64 = 5;
    const EUnauthorizedCancel: u64 = 9;

    /// Event emitted when a new group payment request is created
    public struct GroupPaymentCreatedEvent has copy, drop {
        request_id: address,
        payers: vector<address>,
        amounts: vector<u64>,
        payers_count: u64,
        total_amount: u64,
        recipient: address,
        creator: address,
        description: vector<u8>,
    }

    /// Event emitted when someone contributes to a group payment
    public struct ContributionEvent has copy, drop {
        request_id: address,
        contributor: address,
        amount: u64,
        remaining_contributors: u64,
        total_collected: u64,
    }

    /// Event emitted when payment is cancelled
    public struct PaymentCancelledEvent has copy, drop {
        request_id: address,
        reason: vector<u8>,
    }

    /// Create a group payment request (simplified without expiry)
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

        // Initialize paid status for all payers
        let mut paid_status = vec_map::empty<address, bool>();
        i = 0;
        while (i < payers_len) {
            let payer = *vector::borrow(&payers, i);
            vec_map::insert(&mut paid_status, payer, false);
            i = i + 1;
        };

        let current_time = sui::tx_context::epoch(ctx);

        // Create payment request
        let request = GroupPaymentRequest<T> {
            id: obj_new(ctx),
            payers: payers,
            amounts: amounts,
            paid_status,
            recipient,
            description: description,
            created_at: current_time,
            creator: sender(ctx),
            total_amount,
            total_collected: 0,
        };

        let request_id = uid_to_address(&request.id);

        // Emit event for frontend filtering
        event::emit(GroupPaymentCreatedEvent {
            request_id,
            payers: request.payers,
            amounts: request.amounts,
            payers_count: payers_len,
            total_amount,
            recipient,
            creator: sender(ctx),
            description: request.description,
        });

        // Share the object
        share_object(request);
    }

    /// Contribute to a group payment (payment sent immediately to recipient)
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
        let has_paid = *vec_map::get(&request.paid_status, &sender);
        assert!(!has_paid, EAlreadyContributed);
        
        // Check if amount is correct
        let expected_amount = *vector::borrow(&request.amounts, payer_index);
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= expected_amount, EInsufficientAmount);
        
        // Split exact amount if needed
        if (payment_amount > expected_amount) {
            let remainder = coin::split(&mut payment, payment_amount - expected_amount, ctx);
            public_transfer(remainder, sender);
        };
        
        // Mark as paid
        *vec_map::get_mut(&mut request.paid_status, &sender) = true;
        request.total_collected = request.total_collected + expected_amount;
        
        // Send payment directly to recipient
        public_transfer(payment, request.recipient);
        
        // Calculate remaining contributors
        let mut paid_count = 0;
        let contributors = vec_map::keys(&request.paid_status);
        let mut i = 0;
        while (i < vector::length(&contributors)) {
            let contributor = *vector::borrow(&contributors, i);
            if (*vec_map::get(&request.paid_status, &contributor)) {
                paid_count = paid_count + 1;
            };
            i = i + 1;
        };
        let remaining_contributors = vector::length(&request.payers) - paid_count;
        
        // Emit event
        event::emit(ContributionEvent {
            request_id: uid_to_address(&request.id),
            contributor: sender,
            amount: expected_amount,
            remaining_contributors,
            total_collected: request.total_collected,
        });
    }

    /// Cancel payment request (only creator can do this)
    public fun cancel_and_refund<T>(
        request: &mut GroupPaymentRequest<T>,
        ctx: &mut TxContext
    ) {
        cancel_payment_with_reason<T>(request, b"Cancelled by creator", ctx);
    }

    /// Cancel payment request with reason (only creator can do this)
    public fun cancel_payment_with_reason<T>(
        request: &mut GroupPaymentRequest<T>,
        reason: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = sender(ctx);
        
        // Only creator can cancel
        assert!(sender == request.creator, EUnauthorizedCancel);
        
        // Emit cancel event
        event::emit(PaymentCancelledEvent {
            request_id: uid_to_address(&request.id),
            reason,
        });
        
        // Note: Since payments are sent directly to recipient, 
        // we can't refund automatically. This just marks the request as cancelled.
    }

    /// Manual release function (for backward compatibility - does nothing since payments are automatic)
    public fun manual_release<T>(
        _request: &mut GroupPaymentRequest<T>,
        _ctx: &mut TxContext
    ) {
        // This function exists for backward compatibility but does nothing
        // since payments are now sent directly to recipient when contributed
    }

    // --- View Functions for Frontend ---

    /// Get payment request details for display
    public fun get_payment_details<T>(request: &GroupPaymentRequest<T>): (
        vector<address>,  // payers
        vector<u64>,      // amounts
        address,          // recipient
        vector<u8>,       // description
        u64,              // created_at
        address,          // creator
        u64,              // total_amount
        u64,              // total_collected
        vector<address>,  // paid_contributors
        vector<address>   // unpaid_contributors
    ) {
        let mut paid_contributors = vector::empty<address>();
        let mut unpaid_contributors = vector::empty<address>();
        
        let contributors = vec_map::keys(&request.paid_status);
        let mut i = 0;
        while (i < vector::length(&contributors)) {
            let contributor = *vector::borrow(&contributors, i);
            if (*vec_map::get(&request.paid_status, &contributor)) {
                vector::push_back(&mut paid_contributors, contributor);
            } else {
                vector::push_back(&mut unpaid_contributors, contributor);
            };
            i = i + 1;
        };

        (
            request.payers,
            request.amounts,
            request.recipient,
            request.description,
            request.created_at,
            request.creator,
            request.total_amount,
            request.total_collected,
            paid_contributors,
            unpaid_contributors
        )
    }

    /// Check if a specific address has contributed
    public fun has_contributed<T>(request: &GroupPaymentRequest<T>, addr: address): bool {
        if (vec_map::contains(&request.paid_status, &addr)) {
            *vec_map::get(&request.paid_status, &addr)
        } else {
            false
        }
    }

    /// Get list of paid contributors
    public fun get_paid_contributors<T>(request: &GroupPaymentRequest<T>): vector<address> {
        let mut paid_contributors = vector::empty<address>();
        let contributors = vec_map::keys(&request.paid_status);
        let mut i = 0;
        while (i < vector::length(&contributors)) {
            let contributor = *vector::borrow(&contributors, i);
            if (*vec_map::get(&request.paid_status, &contributor)) {
                vector::push_back(&mut paid_contributors, contributor);
            };
            i = i + 1;
        };
        paid_contributors
    }

    /// Get list of unpaid contributors
    public fun get_unpaid_contributors<T>(request: &GroupPaymentRequest<T>): vector<address> {
        let mut unpaid_contributors = vector::empty<address>();
        let contributors = vec_map::keys(&request.paid_status);
        let mut i = 0;
        while (i < vector::length(&contributors)) {
            let contributor = *vector::borrow(&contributors, i);
            if (!*vec_map::get(&request.paid_status, &contributor)) {
                vector::push_back(&mut unpaid_contributors, contributor);
            };
            i = i + 1;
        };
        unpaid_contributors
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
}