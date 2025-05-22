import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useTheme } from '../context/ThemeContext';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (account) {
      loadTransactions();
    }
  }, [account]);

  const loadTransactions = async () => {
    if (!account) return;

    setIsLoading(true);
    try {
      const result = await suiClient.queryTransactionBlocks({
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

      const parsedTransactions = result.data.map(transaction => {
        const txn = transaction;
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
              // Try to extract recipient count from arguments
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
              // Extract created object ID from effects
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
              if (moveCall.arguments && moveCall.arguments.length >= 2) {
                try {
                  const requestId = moveCall.arguments[0];
                  if (requestId.Pure) {
                    details.requestId = requestId.Pure[1];
                  }
                } catch (e) {
                  details.requestId = 'N/A';
                }
              }
            } else if (target.includes('::group_payment::manual_release')) {
              transactionType = 'Manual Release Payment';
              if (moveCall.arguments && moveCall.arguments.length >= 1) {
                try {
                  const requestId = moveCall.arguments[0];
                  if (requestId.Pure) {
                    details.requestId = requestId.Pure[1];
                  }
                } catch (e) {
                  details.requestId = 'N/A';
                }
              }
            } else if (target.includes('::group_payment::cancel_and_refund')) {
              transactionType = 'Cancel & Refund Payment';
              if (moveCall.arguments && moveCall.arguments.length >= 1) {
                try {
                  const requestId = moveCall.arguments[0];
                  if (requestId.Pure) {
                    details.requestId = requestId.Pure[1];
                  }
                } catch (e) {
                  details.requestId = 'N/A';
                }
              }
            }

            return {
              digest: txn.digest,
              timestamp: new Date(Number(txn.timestampMs)).toLocaleString(),
              type: transactionType,
              status: txn.effects?.status?.status === 'success' ? 'Success' : 'Failed',
              details,
              gasUsed: txn.effects?.gasUsed?.computationCost || 0,
            };
          }
        }
        return null;
      }).filter(Boolean);

      setTransactions(parsedTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className={`text-center py-8 ${
        isDarkMode ? 'text-gray-300' : 'text-gray-500'
      }`}>
        No transactions found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Transaction History
        </h2>
        <p className={`mt-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-600'}`}>
          View your recent transactions
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y ${
          isDarkMode ? 'divide-gray-700' : 'divide-gray-200'
        }`}>
          <thead className={isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}>
            <tr>
              <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Time
              </th>
              <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Type
              </th>
              <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Status
              </th>
              <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Details
              </th>
              <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                Gas Used
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${
            isDarkMode ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'
          }`}>
            {transactions.map((tx) => (
              <tr key={tx.digest} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  {tx.timestamp}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {tx.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    tx.status === 'Success'
                      ? isDarkMode
                        ? 'bg-green-900 text-green-200'
                        : 'bg-green-100 text-green-800'
                      : isDarkMode
                        ? 'bg-red-900 text-red-200'
                        : 'bg-red-100 text-red-800'
                  }`}>
                    {tx.status}
                  </span>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  {Object.entries(tx.details).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-medium">{key}:</span> {value}
                    </div>
                  ))}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  {tx.gasUsed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 