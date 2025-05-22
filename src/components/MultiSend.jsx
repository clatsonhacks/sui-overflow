import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransactionBlock, useSuiClient } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { useTheme } from '../context/ThemeContext';

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x1166b49490f8f7916a670afd8c8134f008005551f16c761250689afc2a487f8d';

export default function MultiSend() {
  const [recipients, setRecipients] = useState('');
  const [amounts, setAmounts] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const suiClient = useSuiClient();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    // Calculate total amount whenever amounts change
    const total = amounts
      .split('\n')
      .filter(a => a.trim())
      .reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0);
    setTotalAmount(total);
  }, [amounts]);

  const handleMultiSend = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Multi-Send SUI
        </h2>
        <p className={`mt-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-600'}`}>
          Send SUI tokens to multiple addresses in one transaction
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              Recipients (one per line)
            </label>
            <textarea
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className={`block w-full rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500'
              }`}
              rows={6}
              placeholder="0x123...&#10;0x456...&#10;0x789..."
            />
            <p className={`mt-1 text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {recipients.split('\n').filter(r => r.trim()).length} recipient(s)
            </p>
          </div>
        </div>

        <div className="space-y-4">
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
              rows={6}
              placeholder="1.5&#10;2.0&#10;0.5"
            />
            <div className="mt-2 flex justify-between items-center text-sm">
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                {amounts.split('\n').filter(a => a.trim()).length} amount(s)
              </span>
              <span className={`font-medium ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Total: {totalAmount.toFixed(2)} SUI
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleMultiSend}
          disabled={isLoading || !recipients.trim() || !amounts.trim()}
          className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white 
            ${isLoading || !recipients.trim() || !amounts.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            } transition-colors duration-200`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Send SUI'
          )}
        </button>
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
          <li>• Enter recipient addresses and amounts in the same order</li>
          <li>• Each line in the recipients field corresponds to the same line in the amounts field</li>
          <li>• The total amount will be automatically calculated</li>
          <li>• Make sure you have enough SUI in your wallet to cover the total amount plus gas fees</li>
        </ul>
      </div>
    </div>
  );
} 