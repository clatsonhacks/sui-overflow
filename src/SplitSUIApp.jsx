import React, { useState, useEffect } from 'react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransactionBlock, useSuiClient } from '@mysten/dapp-kit';

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x1166b49490f8f7916a670afd8c8134f008005551f16c761250689afc2a487f8d';

export default function SplitSUIApp() {
  const [activeTab, setActiveTab] = useState('multi-send');
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const suiClient = useSuiClient();

  // Multi-send state
  const [recipients, setRecipients] = useState('');
  const [amounts, setAmounts] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);

  // Group payment state
  const [payers, setPayers] = useState('');
  const [payerAmounts, setPayerAmounts] = useState('');
  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');

  // Contribute to group payment state
  const [requestId, setRequestId] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');

  // Manage payment state
  const [manageRequestId, setManageRequestId] = useState('');
  const [paymentRequests, setPaymentRequests] = useState([]);

  // Calculate total for multi-send
  useEffect(() => {
    const amountList = amounts.split('\n').filter(a => a.trim());
    const total = amountList.reduce((sum, amount) => {
      const num = parseFloat(amount.trim());
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
    setTotalAmount(total);
  }, [amounts]);

  const handleMultiSend = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      const recipientList = recipients.split('\n').filter(r => r.trim()).map(r => r.trim());
      const amountList = amounts.split('\n').filter(a => a.trim()).map(a => {
        const num = parseFloat(a.trim());
        return Math.floor(num * 1000000000); // Convert to MIST
      });

      if (recipientList.length !== amountList.length) {
        alert('Number of recipients must match number of amounts');
        return;
      }

      // Get user's SUI coins
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: '0x2::sui::SUI',
      });

      if (coins.data.length === 0) {
        alert('No SUI coins found in wallet');
        return;
      }

      const txb = new TransactionBlock();
      
      // Use the first coin
      const coinInput = txb.object(coins.data[0].coinObjectId);

      txb.moveCall({
        target: `${PACKAGE_ID}::split_sui::multi_send_sui`,
        arguments: [
          coinInput,
          txb.pure(recipientList),
          txb.pure(amountList, 'vector<u64>'),
        ],
      });

      signAndExecute(
        { transactionBlock: txb },
        {
          onSuccess: (result) => {
            console.log('Multi-send successful:', result);
            alert('Multi-send completed successfully!');
            setRecipients('');
            setAmounts('');
          },
          onError: (error) => {
            console.error('Multi-send failed:', error);
            alert('Multi-send failed: ' + error.message);
          },
        }
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleCreateGroupPayment = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      const payerList = payers.split('\n').filter(p => p.trim()).map(p => p.trim());
      const amountList = payerAmounts.split('\n').filter(a => a.trim()).map(a => {
        const num = parseFloat(a.trim());
        return Math.floor(num * 1000000000); // Convert to MIST
      });

      if (payerList.length !== amountList.length) {
        alert('Number of payers must match number of amounts');
        return;
      }

      if (!recipient.trim()) {
        alert('Please enter recipient address');
        return;
      }

      const txb = new TransactionBlock();

      txb.moveCall({
        target: `${PACKAGE_ID}::group_payment::create_group_payment`,
        arguments: [
          txb.pure(payerList),
          txb.pure(amountList, 'vector<u64>'),
          txb.pure(recipient.trim()),
          txb.pure(Array.from(new TextEncoder().encode(description || 'Group payment'))),
        ],
        typeArguments: ['0x2::sui::SUI'],
      });

      signAndExecute(
        { transactionBlock: txb },
        {
          onSuccess: (result) => {
            console.log('Group payment created:', result);
            alert('Group payment request created successfully!');
            setPayers('');
            setPayerAmounts('');
            setRecipient('');
            setDescription('');
          },
          onError: (error) => {
            console.error('Group payment creation failed:', error);
            alert('Group payment creation failed: ' + error.message);
          },
        }
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleContributeToPayment = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    if (!requestId.trim() || !contributionAmount.trim()) {
      alert('Please enter both request ID and contribution amount');
      return;
    }

    try {
      const amountInMist = Math.floor(parseFloat(contributionAmount) * 1000000000);

      // Get user's SUI coins
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: '0x2::sui::SUI',
      });

      if (coins.data.length === 0) {
        alert('No SUI coins found in wallet');
        return;
      }

      const txb = new TransactionBlock();
      
      // Split the exact amount needed
      const coinInput = txb.object(coins.data[0].coinObjectId);
      const payment = txb.splitCoins(coinInput, [txb.pure(amountInMist)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::group_payment::contribute`,
        arguments: [
          txb.object(requestId.trim()),
          payment,
        ],
        typeArguments: ['0x2::sui::SUI'],
      });

      signAndExecute(
        { transactionBlock: txb },
        {
          onSuccess: (result) => {
            console.log('Contribution successful:', result);
            alert('Contribution made successfully!');
            setRequestId('');
            setContributionAmount('');
          },
          onError: (error) => {
            console.error('Contribution failed:', error);
            alert('Contribution failed: ' + error.message);
          },
        }
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleManualRelease = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    if (!manageRequestId.trim()) {
      alert('Please enter request ID');
      return;
    }

    try {
      const txb = new TransactionBlock();

      txb.moveCall({
        target: `${PACKAGE_ID}::group_payment::manual_release`,
        arguments: [
          txb.object(manageRequestId.trim()),
        ],
        typeArguments: ['0x2::sui::SUI'],
      });

      signAndExecute(
        { transactionBlock: txb },
        {
          onSuccess: (result) => {
            console.log('Manual release successful:', result);
            alert('Payment released successfully!');
            setManageRequestId('');
          },
          onError: (error) => {
            console.error('Manual release failed:', error);
            alert('Manual release failed: ' + error.message);
          },
        }
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleCancelAndRefund = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    if (!manageRequestId.trim()) {
      alert('Please enter request ID');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to cancel this payment request and refund all contributors?');
    if (!confirmed) return;

    try {
      const txb = new TransactionBlock();

      txb.moveCall({
        target: `${PACKAGE_ID}::group_payment::cancel_and_refund`,
        arguments: [
          txb.object(manageRequestId.trim()),
        ],
        typeArguments: ['0x2::sui::SUI'],
      });

      signAndExecute(
        { transactionBlock: txb },
        {
          onSuccess: (result) => {
            console.log('Cancel and refund successful:', result);
            alert('Payment request cancelled and refunds processed!');
            setManageRequestId('');
          },
          onError: (error) => {
            console.error('Cancel and refund failed:', error);
            alert('Cancel and refund failed: ' + error.message);
          },
        }
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SplitSUI</h1>
          <p className="text-gray-600">Multi-send and group payments on Sui blockchain</p>
          <div className="mt-4">
            <ConnectButton />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-sm p-1">
            <button
              onClick={() => setActiveTab('multi-send')}
              className={`px-4 py-2 rounded-md transition-colors text-sm ${
                activeTab === 'multi-send'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Multi-Send
            </button>
            <button
              onClick={() => setActiveTab('create-group')}
              className={`px-4 py-2 rounded-md transition-colors text-sm ${
                activeTab === 'create-group'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Create Group Payment
            </button>
            <button
              onClick={() => setActiveTab('contribute')}
              className={`px-4 py-2 rounded-md transition-colors text-sm ${
                activeTab === 'contribute'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Contribute
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2 rounded-md transition-colors text-sm ${
                activeTab === 'manage'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Manage Payments
            </button>
          </div>
        </div>

        {/* Multi-Send Tab */}
        {activeTab === 'multi-send' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold mb-4">Multi-Send SUI</h2>
            <p className="text-gray-600 mb-6">Send SUI tokens to multiple addresses in one transaction</p>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipients (one address per line)
                </label>
                <textarea
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="0x123...&#10;0x456...&#10;0x789..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amounts in SUI (one amount per line)
                </label>
                <textarea
                  value={amounts}
                  onChange={(e) => setAmounts(e.target.value)}
                  placeholder="1.0&#10;2.5&#10;0.1"
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Total: {totalAmount.toFixed(2)} SUI
                </p>
              </div>
            </div>
            
            <button
              onClick={handleMultiSend}
              disabled={!account || !recipients.trim() || !amounts.trim()}
              className="w-full mt-6 bg-blue-500 text-white py-3 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Send to Multiple Recipients
            </button>
          </div>
        )}

        {/* Create Group Payment Tab */}
        {activeTab === 'create-group' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold mb-4">Create Group Payment</h2>
            <p className="text-gray-600 mb-6">Create a payment request where multiple people contribute</p>
            
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payers (one address per line)
                  </label>
                  <textarea
                    value={payers}
                    onChange={(e) => setPayers(e.target.value)}
                    placeholder="0x123...&#10;0x456...&#10;0x789..."
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amounts each payer owes (one amount per line)
                  </label>
                  <textarea
                    value={payerAmounts}
                    onChange={(e) => setPayerAmounts(e.target.value)}
                    placeholder="10.0&#10;15.5&#10;5.2"
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x123..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Dinner bill, rent payment, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <button
              onClick={handleCreateGroupPayment}
              disabled={!account || !payers.trim() || !payerAmounts.trim() || !recipient.trim()}
              className="w-full mt-6 bg-green-500 text-white py-3 px-4 rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Create Group Payment Request
            </button>
          </div>
        )}

        {/* Contribute to Group Payment Tab */}
        {activeTab === 'contribute' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold mb-4">Contribute to Group Payment</h2>
            <p className="text-gray-600 mb-6">Pay your share of an existing group payment request</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Request ID
                </label>
                <input
                  type="text"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  placeholder="0x123..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The object ID of the group payment request you want to contribute to
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Contribution Amount (SUI)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  placeholder="10.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the exact amount you're supposed to contribute
                </p>
              </div>
            </div>
            
            <button
              onClick={handleContributeToPayment}
              disabled={!account || !requestId.trim() || !contributionAmount.trim()}
              className="w-full mt-6 bg-purple-500 text-white py-3 px-4 rounded-md hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Make Contribution
            </button>
          </div>
        )}

        {/* Manage Payments Tab */}
        {activeTab === 'manage' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold mb-4">Manage Group Payments</h2>
            <p className="text-gray-600 mb-6">Release payments manually or cancel and refund</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Request ID
                </label>
                <input
                  type="text"
                  value={manageRequestId}
                  onChange={(e) => setManageRequestId(e.target.value)}
                  placeholder="0x123..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={handleManualRelease}
                  disabled={!account || !manageRequestId.trim()}
                  className="w-full bg-green-500 text-white py-3 px-4 rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Manual Release Payment
                </button>
                
                <button
                  onClick={handleCancelAndRefund}
                  disabled={!account || !manageRequestId.trim()}
                  className="w-full bg-red-500 text-white py-3 px-4 rounded-md hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel & Refund All
                </button>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">Important Notes:</h3>
                <ul className="text-xs text-yellow-700 space-y-1">
                  <li>• <strong>Manual Release:</strong> Only the recipient can manually release payments before all contributions are received</li>
                  <li>• <strong>Cancel & Refund:</strong> Only the payment creator can cancel and refund all contributors</li>
                  <li>• Payments are automatically released when all required contributions are received</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500">
          <p>Contract deployed on Sui testnet</p>
          <p className="text-xs mt-1 break-all">Package ID: {PACKAGE_ID}</p>
        </div>
      </div>
    </div>
  );
}