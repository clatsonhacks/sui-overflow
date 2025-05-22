import React, { useState, useEffect } from 'react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransactionBlock, useSuiClient } from '@mysten/dapp-kit';

const PACKAGE_ID = '0xdd0b929609fd7766c2593893e2f0498d900de081deec222b4f1324f6b1e514c9';

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

  // Payment requests state
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [createdRequests, setCreatedRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load payment requests when account changes or tab changes
  useEffect(() => {
    if (account && (activeTab === 'contribute' || activeTab === 'manage')) {
      loadPaymentRequests();
    } else if (account && activeTab === 'transactions') {
      loadTransactions();
    }
  }, [account, activeTab]);

  // Calculate total amount when amounts change
  useEffect(() => {
    if (amounts.trim()) {
      const amountList = amounts.split('\n')
        .filter(a => a.trim())
        .map(a => parseFloat(a.trim()) || 0);
      setTotalAmount(amountList.reduce((sum, amount) => sum + amount, 0));
    } else {
      setTotalAmount(0);
    }
  }, [amounts]);

  const loadPaymentRequests = async () => {
    if (!account || !suiClient) return;
    
    setLoadingRequests(true);
    try {
      // Query all GroupPaymentRequest objects
      const objects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: `${PACKAGE_ID}::group_payment::GroupPaymentRequest<0x2::sui::SUI>`
        },
        options: {
          showContent: true,
          showType: true,
        }
      });

      // Also query shared objects that might include our requests
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::group_payment::GroupPaymentCreatedEvent`
        },
        limit: 100,
        order: 'descending'
      });

      const userRequests = [];
      const userCreatedRequests = [];

      // Process events to find relevant payment requests
      for (const event of events.data) {
        if (event.parsedJson) {
          const eventData = event.parsedJson;
          const requestId = eventData.request_id;
          
          // Check if user is involved in this payment
          const isCreator = eventData.creator === account.address;
          const isPayer = eventData.payers && eventData.payers.includes(account.address);
          
          if (isCreator || isPayer) {
            try {
              // Get the current state of the payment request
              const objectData = await suiClient.getObject({
                id: requestId,
                options: {
                  showContent: true,
                  showType: true,
                }
              });

              if (objectData.data && objectData.data.content) {
                const content = objectData.data.content;
                if (content.dataType === 'moveObject' && content.fields) {
                  const fields = content.fields;
                  
                  // Calculate user's required amount if they're a payer
                  let userAmount = 0;
                  let userContributed = false;
                  
                  if (isPayer && fields.payers && fields.amounts) {
                    const payerIndex = fields.payers.indexOf(account.address);
                    if (payerIndex !== -1 && fields.amounts[payerIndex]) {
                      userAmount = parseFloat(fields.amounts[payerIndex]) / 1000000000; // Convert from MIST
                    }
                    
                    // Check if user has contributed using paid_status
                    if (fields.paid_status && fields.paid_status.fields && fields.paid_status.fields.contents) {
                      const paidStatusEntry = fields.paid_status.fields.contents.find(
                        entry => entry.fields && entry.fields.key === account.address
                      );
                      userContributed = paidStatusEntry ? paidStatusEntry.fields.value : false;
                    }
                  }

                  // Get list of paid and unpaid contributors
                  const paidContributors = [];
                  const unpaidContributors = [];
                  
                  if (fields.paid_status && fields.paid_status.fields && fields.paid_status.fields.contents) {
                    fields.paid_status.fields.contents.forEach(entry => {
                      if (entry.fields) {
                        if (entry.fields.value) {
                          paidContributors.push(entry.fields.key);
                        } else {
                          unpaidContributors.push(entry.fields.key);
                        }
                      }
                    });
                  }

                  const requestData = {
                    id: requestId,
                    payers: fields.payers || [],
                    amounts: (fields.amounts || []).map(amount => parseFloat(amount) / 1000000000),
                    recipient: fields.recipient,
                    description: fields.description ? new TextDecoder().decode(new Uint8Array(fields.description)) : '',
                    createdAt: fields.created_at,
                    creator: fields.creator,
                    totalAmount: parseFloat(fields.total_amount || 0) / 1000000000,
                    totalCollected: parseFloat(fields.total_collected || 0) / 1000000000,
                    paidContributors,
                    unpaidContributors,
                    userAmount,
                    userContributed,
                    isCreator,
                    isPayer
                  };

                  if (isCreator) {
                    userCreatedRequests.push(requestData);
                  }
                  if (isPayer) {
                    userRequests.push(requestData);
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching payment request:', requestId, error);
            }
          }
        }
      }

      setPaymentRequests(userRequests);
      setCreatedRequests(userCreatedRequests);
    } catch (error) {
      console.error('Error loading payment requests:', error);
      alert('Error loading payment requests: ' + error.message);
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadTransactions = async () => {
    if (!account || !suiClient) return;
    
    setLoading(true);
    try {
      // Get transactions from the user's address
      const txns = await suiClient.queryTransactionBlocks({
        filter: {
          FromAddress: account.address,
        },
        options: {
          showEffects: true,
          showEvents: true,
          showInput: true,
          showObjectChanges: true,
        },
        limit: 50,
      });

      const parsedTransactions = [];

      for (const txn of txns.data) {
        if (!txn.transaction || !txn.transaction.data || !txn.transaction.data.transaction) continue;
        
        const transaction = txn.transaction.data.transaction;
        if (transaction.kind !== 'ProgrammableTransaction') continue;

        const commands = transaction.transactions || [];
        
        for (const command of commands) {
          if (command.MoveCall) {
            const moveCall = command.MoveCall;
            const target = `${moveCall.package}::${moveCall.module}::${moveCall.function}`;
            
            let transactionType = 'Unknown';
            let details = {};
            
            // Parse different transaction types
            if (target.includes('::split_sui::multi_send_sui')) {
              transactionType = 'Multi-Send';
              if (moveCall.arguments && moveCall.arguments.length >= 2) {
                try {
                  const recipients = moveCall.arguments[1];
                  if (recipients.Pure) {
                    details.recipientCount = recipients.Pure[1]?.length || 'N/A';
                  }
                } catch (e) {
                  details.recipientCount = 'N/A';
                }
              }
            } else if (target.includes('::group_payment::create_group_payment')) {
              transactionType = 'Create Group Payment';
              if (txn.effects?.created) {
                const createdObjects = txn.effects.created;
                const groupPaymentObject = createdObjects.find(obj => 
                  obj.owner && typeof obj.owner === 'object' && obj.owner.Shared
                );
                if (groupPaymentObject) {
                  details.requestId = groupPaymentObject.reference.objectId;
                }
              }
            } else if (target.includes('::group_payment::contribute')) {
              transactionType = 'Contribute to Group Payment';
              if (moveCall.arguments && moveCall.arguments.length >= 1) {
                const requestArg = moveCall.arguments[0];
                if (requestArg.Object) {
                  details.requestId = requestArg.Object.ImmOrOwnedObject || requestArg.Object.SharedObject?.objectId;
                }
              }
            } else if (target.includes('::group_payment::cancel_and_refund')) {
              transactionType = 'Cancel Payment Request';
              if (moveCall.arguments && moveCall.arguments.length >= 1) {
                const requestArg = moveCall.arguments[0];
                if (requestArg.Object) {
                  details.requestId = requestArg.Object.ImmOrOwnedObject || requestArg.Object.SharedObject?.objectId;
                }
              }
            }
            
            if (transactionType !== 'Unknown') {
              // Extract events for additional information
              const events = txn.events || [];
              const relevantEvents = events.filter(event => 
                event.type.includes('GroupPaymentCreatedEvent') ||
                event.type.includes('ContributionEvent') ||
                event.type.includes('PaymentCancelledEvent')
              );

              // Extract additional details from events
              relevantEvents.forEach(event => {
                if (event.parsedJson) {
                  if (event.type.includes('GroupPaymentCreatedEvent')) {
                    details.totalAmount = event.parsedJson.total_amount ? 
                      (parseInt(event.parsedJson.total_amount) / 1000000000).toFixed(2) + ' SUI' : 'N/A';
                    details.payersCount = event.parsedJson.payers_count || 'N/A';
                    details.recipient = event.parsedJson.recipient || 'N/A';
                  } else if (event.type.includes('ContributionEvent')) {
                    details.amount = event.parsedJson.amount ? 
                      (parseInt(event.parsedJson.amount) / 1000000000).toFixed(2) + ' SUI' : 'N/A';
                    details.contributor = event.parsedJson.contributor || 'N/A';
                  }
                }
              });

              parsedTransactions.push({
                digest: txn.digest,
                timestamp: txn.timestampMs ? new Date(parseInt(txn.timestampMs)).toLocaleString() : 'N/A',
                type: transactionType,
                status: txn.effects?.status?.status === 'success' ? 'Success' : 'Failed',
                details,
                gasUsed: txn.effects?.gasUsed ? 
                  Object.values(txn.effects.gasUsed).reduce((a, b) => parseInt(a) + parseInt(b), 0) : 'N/A',
              });
            }
          }
        }
      }

      setTransactions(parsedTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
      alert('Error loading transactions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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

      const totalAmountNeeded = amountList.reduce((sum, amount) => sum + amount, 0);
      const gasBuffer = 50000000; // 0.05 SUI buffer for gas fees

      // Get user's SUI coins
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: '0x2::sui::SUI',
      });

      if (coins.data.length === 0) {
        alert('No SUI coins found in wallet');
        return;
      }

      // Sort coins by balance (largest first)
      const sortedCoins = coins.data
        .map(coin => ({
          ...coin,
          balance: parseInt(coin.balance)
        }))
        .sort((a, b) => b.balance - a.balance);

      // Find a coin that has enough balance for total amount + gas
      let suitableCoin = sortedCoins.find(coin => coin.balance >= totalAmountNeeded + gasBuffer);
      
      if (!suitableCoin) {
        suitableCoin = sortedCoins[0];
        if (suitableCoin.balance < totalAmountNeeded) {
          alert(`Insufficient balance. You need ${(totalAmountNeeded / 1000000000).toFixed(2)} SUI + gas fees, but your largest coin only has ${(suitableCoin.balance / 1000000000).toFixed(2)} SUI`);
          return;
        }
      }

      const txb = new TransactionBlock();
      
      // Use the suitable coin
      const coinInput = txb.object(suitableCoin.coinObjectId);

      txb.moveCall({
        target: `${PACKAGE_ID}::split_sui::multi_send_sui`,
        arguments: [
          coinInput,
          txb.pure(recipientList),
          txb.pure(amountList, 'vector<u64>'),
        ],
      });

      // Set gas budget
      txb.setGasBudget(10000000); // 0.01 SUI gas budget

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

      // Use the simplified create function
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
            // Reload requests to show the new one
            loadPaymentRequests();
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

  const handleContributeToPayment = async (requestId, amount) => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      const amountInMist = Math.floor(amount * 1000000000);
      const gasBuffer = 50000000; // 0.05 SUI buffer for gas fees

      // Get user's SUI coins
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: '0x2::sui::SUI',
      });

      if (coins.data.length === 0) {
        alert('No SUI coins found in wallet');
        return;
      }

      // Sort coins by balance (largest first) and find suitable coins
      const sortedCoins = coins.data
        .map(coin => ({
          ...coin,
          balance: parseInt(coin.balance)
        }))
        .sort((a, b) => b.balance - a.balance);

      // Find a coin that has enough balance for contribution + gas
      let suitableCoin = sortedCoins.find(coin => coin.balance >= amountInMist + gasBuffer);
      
      if (!suitableCoin) {
        // If no single coin has enough, try to use the largest coin available
        suitableCoin = sortedCoins[0];
        
        if (suitableCoin.balance < amountInMist) {
          alert(`Insufficient balance. You need ${amount} SUI + gas fees, but your largest coin only has ${(suitableCoin.balance / 1000000000).toFixed(2)} SUI`);
          return;
        }
      }

      console.log(`Using coin with balance: ${(suitableCoin.balance / 1000000000).toFixed(2)} SUI for contribution: ${amount} SUI`);

      const txb = new TransactionBlock();
      
      // Use the suitable coin
      const coinInput = txb.object(suitableCoin.coinObjectId);
      
      // Split the exact amount needed for contribution
      const payment = txb.splitCoins(coinInput, [txb.pure(amountInMist)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::group_payment::contribute`,
        arguments: [
          txb.object(requestId),
          payment,
        ],
        typeArguments: ['0x2::sui::SUI'],
      });

      // Set gas budget to ensure transaction can complete
      txb.setGasBudget(10000000); // 0.01 SUI gas budget

      signAndExecute(
        { transactionBlock: txb },
        {
          onSuccess: (result) => {
            console.log('Contribution successful:', result);
            alert('Contribution made successfully! Payment has been sent directly to the recipient.');
            // Reload requests to update status
            loadPaymentRequests();
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

  const handleCancelPayment = async (requestId) => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to cancel this payment request? Note: Payments already made cannot be automatically refunded as they were sent directly to the recipient.');
    if (!confirmed) return;

    try {
      const txb = new TransactionBlock();

      txb.moveCall({
        target: `${PACKAGE_ID}::group_payment::cancel_and_refund`,
        arguments: [
          txb.object(requestId),
        ],
        typeArguments: ['0x2::sui::SUI'],
      });

      signAndExecute(
        { transactionBlock: txb },
        {
          onSuccess: (result) => {
            console.log('Cancel successful:', result);
            alert('Payment request cancelled successfully!');
            loadPaymentRequests();
          },
          onError: (error) => {
            console.error('Cancel failed:', error);
            alert('Cancel failed: ' + error.message);
          },
        }
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  };

  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-6">
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
              My Payments
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
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 rounded-md transition-colors text-sm ${
                activeTab === 'transactions'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Transactions
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
            <p className="text-gray-600 mb-6">Create a payment request where multiple people contribute (payments are sent directly to recipient)</p>
            
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
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-6">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> When contributors pay, their payments will be sent directly to the recipient. The contract will track who has paid for transparency.
              </p>
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

        {/* My Payments Tab */}
        {activeTab === 'contribute' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold">My Payments</h2>
                <p className="text-gray-600">Payments where you need to contribute</p>
              </div>
              <button
                onClick={loadPaymentRequests}
                disabled={loadingRequests}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
              >
                {loadingRequests ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            
            {loadingRequests ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading payment requests...</p>
              </div>
            ) : paymentRequests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No payment requests found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentRequests.map((request, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {request.description || 'Group Payment'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Created by: {formatAddress(request.creator)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          request.userContributed 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {request.userContributed ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Your contribution:</p>
                        <p className="font-semibold">{request.userAmount.toFixed(2)} SUI</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total amount:</p>
                        <p className="font-semibold">{request.totalAmount.toFixed(2)} SUI</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total collected:</p>
                        <p className="font-semibold text-green-600">{request.totalCollected.toFixed(2)} SUI</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Recipient:</p>
                        <p className="font-semibold">{formatAddress(request.recipient)}</p>
                      </div>
                    </div>

                    {/* Payment Status Tracking */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Payment Status:</p>
                      <div className="bg-gray-50 rounded-md p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {request.payers.map((payer, payerIndex) => {
                            const hasPaid = request.paidContributors.includes(payer);
                            const amount = request.amounts[payerIndex];
                            return (
                              <div key={payerIndex} className="flex justify-between items-center py-1">
                                <span className="text-sm flex items-center">
                                  {hasPaid ? (
                                    <span className="text-green-500 mr-1">✓</span>
                                  ) : (
                                    <span className="text-red-500 mr-1">○</span>
                                  )}
                                  {formatAddress(payer)}
                                  {payer === account?.address && <span className="text-blue-600 ml-1">(You)</span>}
                                </span>
                                <span className={`text-sm font-medium ${hasPaid ? 'text-green-600' : 'text-gray-600'}`}>
                                  {amount.toFixed(2)} SUI
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {!request.userContributed && (
                      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          Payment will be sent directly to recipient
                        </div>
                        <button
                          onClick={() => handleContributeToPayment(request.id, request.userAmount)}
                          className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors"
                        >
                          Pay {request.userAmount.toFixed(2)} SUI
                        </button>
                      </div>
                    )}

                    {request.userContributed && (
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm text-green-600 font-medium">
                          ✓ You have contributed {request.userAmount.toFixed(2)} SUI (sent directly to recipient)
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manage Payments Tab */}
        {activeTab === 'manage' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold">Manage Payments</h2>
                <p className="text-gray-600">Payments you created</p>
              </div>
              <button
                onClick={loadPaymentRequests}
                disabled={loadingRequests}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
              >
                {loadingRequests ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            
            {loadingRequests ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading payment requests...</p>
              </div>
            ) : createdRequests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No payment requests created</p>
              </div>
            ) : (
              <div className="space-y-4">
                {createdRequests.map((request, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {request.description || 'Group Payment'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Request ID: {formatAddress(request.id)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Active
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Total amount:</p>
                        <p className="font-semibold">{request.totalAmount.toFixed(2)} SUI</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Collected:</p>
                        <p className="font-semibold text-green-600">{request.totalCollected.toFixed(2)} SUI</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Recipient:</p>
                        <p className="font-semibold">{formatAddress(request.recipient)}</p>
                      </div>
                    </div>

                    {/* Payment Status Tracking */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Payment Status ({request.paidContributors.length} of {request.payers.length} paid):</p>
                      <div className="bg-gray-50 rounded-md p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {request.payers.map((payer, payerIndex) => {
                            const hasPaid = request.paidContributors.includes(payer);
                            const amount = request.amounts[payerIndex];
                            return (
                              <div key={payerIndex} className="flex justify-between items-center py-1">
                                <span className="text-sm flex items-center">
                                  {hasPaid ? (
                                    <span className="text-green-500 mr-1">✓</span>
                                  ) : (
                                    <span className="text-red-500 mr-1">○</span>
                                  )}
                                  {formatAddress(payer)}
                                </span>
                                <span className={`text-sm font-medium ${hasPaid ? 'text-green-600' : 'text-gray-600'}`}>
                                  {amount.toFixed(2)} SUI
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> Payments are sent directly to the recipient when contributors pay. 
                        Collected amount: <strong>{request.totalCollected.toFixed(2)} SUI</strong>
                      </p>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleCancelPayment(request.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
                      >
                        Cancel Request
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold mb-4">Transaction History</h2>
            <p className="text-gray-600 mb-6">View your recent transactions</p>
            
            {loading ? (
              <div className="text-center py-4">
                <p className="text-gray-600">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-600">No transactions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gas Used</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((tx, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {tx.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            tx.status === 'Success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {tx.timestamp}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="space-y-1">
                            {Object.entries(tx.details).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span> {value}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {tx.gasUsed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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