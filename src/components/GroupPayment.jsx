import React, { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransactionBlock, useSuiClient } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { useTheme } from '../context/ThemeContext';

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x1166b49490f8f7916a670afd8c8134f008005551f16c761250689afc2a487f8d';

export default function GroupPayment() {
  const [payers, setPayers] = useState('');
  const [amounts, setAmounts] = useState('');
  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');
  const [requestId, setRequestId] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [manageRequestId, setManageRequestId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const suiClient = useSuiClient();
  const { isDarkMode } = useTheme();

  const handleCreateGroupPayment = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const payerList = payers.split('\n').filter(p => p.trim()).map(p => p.trim());
      const amountList = amounts.split('\n').filter(a => a.trim()).map(a => {
        const num = parseFloat(a.trim());
        return Math.floor(num * 1000000000); // Convert to MIST
      });

      if (payerList.length !== amountList.length) {
        alert('Number of payers must match number of amounts');
        return;
      }

      const txb = new TransactionBlock();
      
      txb.moveCall({
        target: `${PACKAGE_ID}::split_sui::create_group_payment`,
        arguments: [
          txb.pure(payerList),
          txb.pure(amountList, 'vector<u64>'),
          txb.pure(recipient.trim()),
          txb.pure(description.trim()),
        ],
      });

      signAndExecute(
        { transactionBlock: txb },
        {
          onSuccess: (result) => {
            console.log('Group payment created:', result);
            alert('Group payment created successfully!');
            setPayers('');
            setAmounts('');
            setRecipient('');
            setDescription('');
          },
          onError: (error) => {
            console.error('Failed to create group payment:', error);
            alert('Failed to create group payment: ' + error.message);
          },
        }
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContributeToPayment = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const amount = Math.floor(parseFloat(contributionAmount) * 1000000000); // Convert to MIST

      const txb = new TransactionBlock();
      
      txb.moveCall({
        target: `${PACKAGE_ID}::split_sui::contribute_to_payment`,
        arguments: [
          txb.pure(requestId.trim()),
          txb.pure(amount),
        ],
      });

      signAndExecute(
        { transactionBlock: txb },
        {
          onSuccess: (result) => {
            console.log('Contribution successful:', result);
            alert('Contribution successful!');
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRelease = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const txb = new TransactionBlock();
      
      txb.moveCall({
        target: `${PACKAGE_ID}::split_sui::manual_release_payment`,
        arguments: [
          txb.pure(manageRequestId.trim()),
        ],
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAndRefund = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const txb = new TransactionBlock();
      
      txb.moveCall({
        target: `${PACKAGE_ID}::split_sui::cancel_and_refund_payment`,
        arguments: [
          txb.pure(manageRequestId.trim()),
        ],
      });

      signAndExecute(
        { transactionBlock: txb },
        {
          onSuccess: (result) => {
            console.log('Cancel and refund successful:', result);
            alert('Payment cancelled and refunded successfully!');
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Group Payment
        </h2>
        <p className={`mt-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-600'}`}>
          Create and manage group payments with multiple contributors
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Create Group Payment Section */}
        <div className={`rounded-lg shadow-sm p-6 border ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Create Group Payment
          </h3>
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Payers (one per line)
              </label>
              <textarea
                value={payers}
                onChange={(e) => setPayers(e.target.value)}
                className={`block w-full rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500'
                }`}
                rows={4}
                placeholder="0x123...&#10;0x456...&#10;0x789..."
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Amounts in SUI (one per line)
              </label>
              <textarea
                value={amounts}
                onChange={(e) => setAmounts(e.target.value)}
                className={`block w-full rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500'
                }`}
                rows={4}
                placeholder="1.5&#10;2.0&#10;0.5"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className={`block w-full rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500'
                }`}
                placeholder="0x..."
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`block w-full rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500'
                }`}
                placeholder="Enter payment description"
              />
            </div>

            <button
              onClick={handleCreateGroupPayment}
              disabled={isLoading || !payers.trim() || !amounts.trim() || !recipient.trim()}
              className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white 
                ${isLoading || !payers.trim() || !amounts.trim() || !recipient.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                } transition-colors duration-200`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Create Payment'
              )}
            </button>
          </div>
        </div>

        {/* Contribute Section */}
        <div className="space-y-6">
          <div className={`rounded-lg shadow-sm p-6 border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Contribute to Payment
            </h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Request ID
                </label>
                <input
                  type="text"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  className={`block w-full rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500'
                  }`}
                  placeholder="Enter request ID"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Amount in SUI
                </label>
                <input
                  type="number"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  className={`block w-full rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500'
                  }`}
                  placeholder="Enter amount"
                  step="0.000000001"
                />
              </div>

              <button
                onClick={handleContributeToPayment}
                disabled={isLoading || !requestId.trim() || !contributionAmount.trim()}
                className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white 
                  ${isLoading || !requestId.trim() || !contributionAmount.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  } transition-colors duration-200`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Contribute'
                )}
              </button>
            </div>
          </div>

          {/* Manage Payment Section */}
          <div className={`rounded-lg shadow-sm p-6 border ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Manage Payment
            </h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Request ID
                </label>
                <input
                  type="text"
                  value={manageRequestId}
                  onChange={(e) => setManageRequestId(e.target.value)}
                  className={`block w-full rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500'
                  }`}
                  placeholder="Enter request ID"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleManualRelease}
                  disabled={isLoading || !manageRequestId.trim()}
                  className={`flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white 
                    ${isLoading || !manageRequestId.trim()
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                    } transition-colors duration-200`}
                >
                  Release
                </button>
                <button
                  onClick={handleCancelAndRefund}
                  disabled={isLoading || !manageRequestId.trim()}
                  className={`flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white 
                    ${isLoading || !manageRequestId.trim()
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
                    } transition-colors duration-200`}
                >
                  Cancel & Refund
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`rounded-lg p-4 mt-6 ${
        isDarkMode 
          ? 'bg-blue-900/30 border border-blue-800/50' 
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <h3 className={`text-sm font-medium mb-2 ${
          isDarkMode ? 'text-blue-300' : 'text-blue-800'
        }`}>
          How it works:
        </h3>
        <ul className={`text-sm space-y-1 ${
          isDarkMode ? 'text-blue-200' : 'text-blue-700'
        }`}>
          <li>• Create a group payment by specifying payers and their amounts</li>
          <li>• Each payer can contribute their share using the request ID</li>
          <li>• Once all contributions are received, the payment can be released</li>
          <li>• If needed, the payment can be cancelled and refunded to contributors</li>
        </ul>
      </div>
    </div>
  );
} 