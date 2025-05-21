module splitsui::split_sui {
    use sui::sui::SUI;
    // Import the necessary types and functions directly
    use sui::coin::Coin;
    use sui::tx_context::TxContext;
    
    // Import custom modules
    use splitsui::multi_send;
    use splitsui::group_payment;

    /// Entry point for multi-sending SUI tokens
    public entry fun multi_send_sui(
        coin: &mut Coin<SUI>,
        recipients: vector<address>,
        amounts: vector<u64>,
        ctx: &mut TxContext
    ) {
        multi_send::multi_send(coin, recipients, amounts, ctx);
    }

    /// Entry point for creating a group payment request for SUI
    public entry fun create_group_payment_sui(
        payers: vector<address>,
        amounts: vector<u64>,
        recipient: address,
        description: vector<u8>,
        ctx: &mut TxContext
    ) {
        group_payment::create_group_payment<SUI>(
            payers,
            amounts,
            recipient,
            description,
            ctx
        );
    }

    /// Entry point for contributing SUI to a group payment
    public entry fun contribute_sui(
        request: &mut group_payment::GroupPaymentRequest<SUI>,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        group_payment::contribute(request, payment, ctx);
    }

    /// Entry point for manually releasing a SUI payment
    public entry fun release_payment_sui(
        request: &mut group_payment::GroupPaymentRequest<SUI>,
        ctx: &mut TxContext
    ) {
        group_payment::manual_release(request, ctx);
    }

    /// Entry point for cancelling and refunding a SUI payment
    public entry fun cancel_and_refund_sui(
        request: &mut group_payment::GroupPaymentRequest<SUI>,
        ctx: &mut TxContext
    ) {
        group_payment::cancel_and_refund(request, ctx);
    }
}