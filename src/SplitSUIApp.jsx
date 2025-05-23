import React, { useState, useEffect } from 'react';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransactionBlock, useSuiClient } from '@mysten/dapp-kit';

const PACKAGE_ID = '0xdd0b929609fd7766c2593893e2f0498d900de081deec222b4f1324f6b1e514c9';

const icons = {
  Wallet: () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  X: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Upload: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  AlertCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

export default function SplitSUIApp() {
  const [activeTab, setActiveTab] = useState('multi-send');
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const suiClient = useSuiClient();

  const [recipients, setRecipients] = useState([{ address: '', amount: '' }]);
  const [totalAmount, setTotalAmount] = useState(0);

  
  const [payers, setPayers] = useState([{ address: '', amount: '' }]);
  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');


  const [paymentRequests, setPaymentRequests] = useState([]);
  const [createdRequests, setCreatedRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  
  const [csvPreview, setCsvPreview] = useState(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvImportType, setCsvImportType] = useState('');
  const [csvError, setCsvError] = useState('');

  useEffect(() => {
    if (account && (activeTab === 'contribute' || activeTab === 'manage')) {
      loadPaymentRequests();
    } else if (account && activeTab === 'transactions') {
      loadTransactions();
    }
  }, [account, activeTab]);

  useEffect(() => {
    const total = recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    setTotalAmount(total);
  }, [recipients]);

  const parseCSV = (text) => {
    const lines = text.split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

   
    const headerLine = lines[0].trim();
    if (!headerLine) {
      throw new Error('CSV header row is empty');
    }

    const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
   
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; 
      
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} columns but header has ${headers.length} columns`);
        continue;
      }
      
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }

    return data;
  };

  const handleCSVImport = (file, type) => {
    if (!file) return;
    
    setCsvError('');
    
    console.log('Starting CSV import for file:', file.name, 'type:', type);
   
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const data = parseCSV(text);
        
        console.log('CSV Parse Results:', data);
        
        if (!data || data.length === 0) {
          setCsvError('No valid data found in CSV file');
          return;
        }

        const processedData = processCSVData(data);
        
        if (processedData.length === 0) {
          setCsvError('No valid entries found. Please check your CSV format.');
          return;
        }

        
        setCsvPreview(processedData);
        setCsvImportType(type);
        setShowCsvModal(true);
        
      } catch (error) {
        console.error('Error processing CSV data:', error);
        setCsvError('Error processing CSV data: ' + error.message);
      }
    };

    reader.onerror = () => {
      setCsvError('Failed to read CSV file');
    };

    reader.readAsText(file);
  };


  const processCSVData = (data) => {
    const processedData = [];
    const headers = Object.keys(data[0] || {});
    console.log('Available headers:', headers);

   
    const addressColumn = headers.find(h => {
      const normalized = h.toLowerCase();
      return ['address', 'wallet', 'recipient', 'to', 'addr'].includes(normalized);
    });
    
    const amountColumn = headers.find(h => {
      const normalized = h.toLowerCase();
      return ['amount', 'value', 'sum', 'total', 'sui', 'balance', 'payment'].includes(normalized);
    });

    console.log('Detected columns:', { addressColumn, amountColumn });

    if (!addressColumn) {
      throw new Error('Address column not found. Expected headers: address, wallet, recipient, to, or addr');
    }
    
    if (!amountColumn) {
      throw new Error('Amount column not found. Expected headers: amount, value, sum, total, or sui');
    }

    data.forEach((row, index) => {
      try {
        const address = (row[addressColumn] || '').toString().trim();
        const amount = (row[amountColumn] || '').toString().trim();
        
        if (!address || !amount) {
          console.warn(`Empty address or amount in row ${index + 1}`);
          return;
        }

        
        if (!address.startsWith('0x') || address.length < 10) {
          console.warn(`Invalid address format in row ${index + 1}: ${address}`);
          return;
        }

       
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          console.warn(`Invalid amount in row ${index + 1}: ${amount}`);
          return;
        }

        processedData.push({ 
          address: address, 
          amount: numAmount.toString() 
        });
        
      } catch (error) {
        console.warn(`Error processing row ${index + 1}:`, error);
      }
    });

    return processedData;
  };

  const confirmCSVImport = () => {
    if (!csvPreview || !csvImportType) return;

    try {
      if (csvImportType === 'multi-send') {
        setRecipients(csvPreview.length > 0 ? csvPreview : [{ address: '', amount: '' }]);
        setActiveTab('multi-send'); 
      } else if (csvImportType === 'group') {
        setPayers(csvPreview.length > 0 ? csvPreview : [{ address: '', amount: '' }]);
        setActiveTab('create-group'); 
      }

      setShowCsvModal(false);
      setCsvPreview(null);
      setCsvImportType('');
      setCsvError('');

      setTimeout(() => {
        alert(`Successfully imported ${csvPreview.length} entries!`);
      }, 100);
      
    } catch (error) {
      console.error('Error confirming CSV import:', error);
      setCsvError('Error importing CSV data: ' + error.message);
    }
  };

  const cancelCSVImport = () => {
    setShowCsvModal(false);
    setCsvPreview(null);
    setCsvImportType('');
    setCsvError('');
  };

 
  const fileInputRef = React.useRef(null);

  const handleFileInputChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      handleCSVImport(file, type);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addRecipient = () => setRecipients([...recipients, { address: '', amount: '' }]);
  const removeRecipient = (index) => setRecipients(recipients.filter((_, i) => i !== index));
  const updateRecipient = (index, field, value) => {
    const updated = [...recipients];
    updated[index][field] = value;
    setRecipients(updated);
  };

  const addPayer = () => setPayers([...payers, { address: '', amount: '' }]);
  const removePayer = (index) => setPayers(payers.filter((_, i) => i !== index));
  const updatePayer = (index, field, value) => {
    const updated = [...payers];
    updated[index][field] = value;
    setPayers(updated);
  };

  const loadPaymentRequests = async () => {
    if (!account || !suiClient) return;
    setLoading(true);
    try {
      const events = await suiClient.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::group_payment::GroupPaymentCreatedEvent` },
        limit: 100,
        order: 'descending'
      });

      const [userRequests, userCreatedRequests] = [[], []];
      for (const event of events.data) {
        if (event.parsedJson) {
          const eventData = event.parsedJson;
          const requestId = eventData.request_id;
          const isCreator = eventData.creator === account.address;
          const isPayer = eventData.payers?.includes(account.address);
          
          if (isCreator || isPayer) {
            try {
              const objectData = await suiClient.getObject({
                id: requestId,
                options: { showContent: true, showType: true }
              });

              if (objectData.data?.content?.dataType === 'moveObject') {
                const fields = objectData.data.content.fields;
                
                let userAmount = 0, userContributed = false;
                if (isPayer && fields.payers && fields.amounts) {
                  const payerIndex = fields.payers.indexOf(account.address);
                  if (payerIndex !== -1) {
                    userAmount = parseFloat(fields.amounts[payerIndex]) / 1000000000;
                  }
                  
                  if (fields.paid_status?.fields?.contents) {
                    const paidStatusEntry = fields.paid_status.fields.contents.find(
                      entry => entry.fields?.key === account.address
                    );
                    userContributed = paidStatusEntry?.fields?.value || false;
                  }
                }

                const [paidContributors, unpaidContributors] = [[], []];
                if (fields.paid_status?.fields?.contents) {
                  fields.paid_status.fields.contents.forEach(entry => {
                    if (entry.fields) {
                      (entry.fields.value ? paidContributors : unpaidContributors).push(entry.fields.key);
                    }
                  });
                }

                const requestData = {
                  id: requestId,
                  payers: fields.payers || [],
                  amounts: (fields.amounts || []).map(amount => parseFloat(amount) / 1000000000),
                  recipient: fields.recipient,
                  description: fields.description ? new TextDecoder().decode(new Uint8Array(fields.description)) : '',
                  totalAmount: parseFloat(fields.total_amount || 0) / 1000000000,
                  totalCollected: parseFloat(fields.total_collected || 0) / 1000000000,
                  paidContributors,
                  unpaidContributors,
                  userAmount,
                  userContributed,
                  isCreator,
                  isPayer
                };

                if (isCreator) userCreatedRequests.push(requestData);
                if (isPayer) userRequests.push(requestData);
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
      alert('Error loading payment requests: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!account || !suiClient) return;
    setLoading(true);
    try {
      const txns = await suiClient.queryTransactionBlocks({
        filter: { FromAddress: account.address },
        options: { showEffects: true, showEvents: true, showInput: true },
        limit: 50,
      });

      const parsedTransactions = [];
      for (const txn of txns.data) {
        const transaction = txn.transaction?.data?.transaction;
        if (transaction?.kind !== 'ProgrammableTransaction') continue;

        for (const command of transaction.transactions || []) {
          if (command.MoveCall) {
            const moveCall = command.MoveCall;
            const target = `${moveCall.package}::${moveCall.module}::${moveCall.function}`;
            
            let transactionType = 'Unknown';
            if (target.includes('::split_sui::multi_send_sui')) transactionType = 'Multi-Send';
            else if (target.includes('::group_payment::create_group_payment')) transactionType = 'Create Group Payment';
            else if (target.includes('::group_payment::contribute')) transactionType = 'Contribute to Group Payment';
            else if (target.includes('::group_payment::cancel_and_refund')) transactionType = 'Cancel Payment Request';
            
            if (transactionType !== 'Unknown') {
              parsedTransactions.push({
                digest: txn.digest,
                timestamp: txn.timestampMs ? new Date(parseInt(txn.timestampMs)).toLocaleString() : 'N/A',
                type: transactionType,
                status: txn.effects?.status?.status === 'success' ? 'Success' : 'Failed',
                gasUsed: txn.effects?.gasUsed ? Object.values(txn.effects.gasUsed).reduce((a, b) => parseInt(a) + parseInt(b), 0) : 'N/A',
              });
            }
          }
        }
      }
      setTransactions(parsedTransactions);
    } catch (error) {
      alert('Error loading transactions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMultiSend = async () => {
    if (!account) return alert('Please connect your wallet first');

    try {
      const validRecipients = recipients.filter(r => r.address.trim() && r.amount.trim());
      if (validRecipients.length === 0) return alert('Please add at least one recipient with address and amount');

      const recipientList = validRecipients.map(r => r.address.trim());
      const amountList = validRecipients.map(r => Math.floor(parseFloat(r.amount) * 1000000000));

      const totalAmountNeeded = amountList.reduce((sum, amount) => sum + amount, 0);
      const coins = await suiClient.getCoins({ owner: account.address, coinType: '0x2::sui::SUI' });
      
      if (coins.data.length === 0) return alert('No SUI coins found in wallet');

      const suitableCoin = coins.data
        .map(coin => ({ ...coin, balance: parseInt(coin.balance) }))
        .sort((a, b) => b.balance - a.balance)
        .find(coin => coin.balance >= totalAmountNeeded + 50000000);
      
      if (!suitableCoin) return alert('Insufficient balance');

      const txb = new TransactionBlock();
      txb.moveCall({
        target: `${PACKAGE_ID}::split_sui::multi_send_sui`,
        arguments: [
          txb.object(suitableCoin.coinObjectId),
          txb.pure(recipientList),
          txb.pure(amountList, 'vector<u64>'),
        ],
      });
      txb.setGasBudget(10000000);

      signAndExecute({ transactionBlock: txb }, {
        onSuccess: () => {
          alert('Multi-send completed successfully!');
          setRecipients([{ address: '', amount: '' }]);
        },
        onError: (error) => alert('Multi-send failed: ' + error.message),
      });
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleCreateGroupPayment = async () => {
    if (!account) return alert('Please connect your wallet first');

    try {
      const validPayers = payers.filter(p => p.address.trim() && p.amount.trim());
      if (validPayers.length === 0) return alert('Please add at least one payer');
      if (!recipient.trim()) return alert('Please enter recipient address');

      const payerList = validPayers.map(p => p.address.trim());
      const amountList = validPayers.map(p => Math.floor(parseFloat(p.amount) * 1000000000));

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

      signAndExecute({ transactionBlock: txb }, {
        onSuccess: () => {
          alert('Group payment request created successfully!');
          setPayers([{ address: '', amount: '' }]);
          setRecipient('');
          setDescription('');
          loadPaymentRequests();
        },
        onError: (error) => alert('Group payment creation failed: ' + error.message),
      });
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleContributeToPayment = async (requestId, amount) => {
    if (!account) return alert('Please connect your wallet first');

    try {
      const amountInMist = Math.floor(amount * 1000000000);
      const coins = await suiClient.getCoins({ owner: account.address, coinType: '0x2::sui::SUI' });
      
      if (coins.data.length === 0) return alert('No SUI coins found in wallet');

      const suitableCoin = coins.data
        .map(coin => ({ ...coin, balance: parseInt(coin.balance) }))
        .sort((a, b) => b.balance - a.balance)
        .find(coin => coin.balance >= amountInMist + 50000000);
      
      if (!suitableCoin) return alert('Insufficient balance');

      const txb = new TransactionBlock();
      const coinInput = txb.object(suitableCoin.coinObjectId);
      const payment = txb.splitCoins(coinInput, [txb.pure(amountInMist)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::group_payment::contribute`,
        arguments: [txb.object(requestId), payment],
        typeArguments: ['0x2::sui::SUI'],
      });
      txb.setGasBudget(10000000);

      signAndExecute({ transactionBlock: txb }, {
        onSuccess: () => {
          alert('Contribution made successfully!');
          loadPaymentRequests();
        },
        onError: (error) => alert('Contribution failed: ' + error.message),
      });
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleCancelPayment = async (requestId) => {
    if (!account) return alert('Please connect your wallet first');
    if (!window.confirm('Are you sure you want to cancel this payment request?')) return;

    try {
      const txb = new TransactionBlock();
      txb.moveCall({
        target: `${PACKAGE_ID}::group_payment::cancel_and_refund`,
        arguments: [txb.object(requestId)],
        typeArguments: ['0x2::sui::SUI'],
      });

      signAndExecute({ transactionBlock: txb }, {
        onSuccess: () => {
          alert('Payment request cancelled successfully!');
          loadPaymentRequests();
        },
        onError: (error) => alert('Cancel failed: ' + error.message),
      });
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const formatAddress = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'N/A';

  const TabButton = ({ id, label, active, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
        active ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
      }`}
    >
      {label}
    </button>
  );

  const PaymentRequestCard = ({ request, showContribute = false, showManage = false }) => (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg text-white">{request.description || 'Group Payment'}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {showManage ? `Request ID: ${formatAddress(request.id)}` : `Created by: ${formatAddress(request.creator)}`}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          showContribute && request.userContributed 
            ? 'bg-green-900/30 text-green-300 border border-green-500/30'
            : showContribute ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-500/30' 
            : 'bg-blue-900/30 text-blue-300 border border-blue-500/30'
        }`}>
          {showContribute ? (request.userContributed ? 'Paid' : 'Pending') : 'Active'}
        </span>
      </div>
      
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        {showContribute && (
          <div className="bg-gray-700/30 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Your contribution:</p>
            <p className="font-semibold text-blue-400">{request.userAmount.toFixed(2)} SUI</p>
          </div>
        )}
        <div className="bg-gray-700/30 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Total amount:</p>
          <p className="font-semibold text-white">{request.totalAmount.toFixed(2)} SUI</p>
        </div>
        <div className="bg-gray-700/30 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Collected:</p>
          <p className="font-semibold text-green-400">{request.totalCollected.toFixed(2)} SUI</p>
        </div>
        <div className="bg-gray-700/30 rounded-lg p-3 md:col-span-3">
          <p className="text-xs text-gray-400 mb-1">Recipient:</p>
          <p className="font-semibold text-white font-mono">{formatAddress(request.recipient)}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-3">Payment Status ({request.paidContributors.length} of {request.payers.length} paid):</p>
        <div className="bg-gray-700/30 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {request.payers.map((payer, payerIndex) => {
              const hasPaid = request.paidContributors.includes(payer);
              const amount = request.amounts[payerIndex];
              return (
                <div key={payerIndex} className="flex justify-between items-center py-2 px-2 rounded border-l-2 border-gray-600">
                  <span className="text-sm flex items-center">
                    {hasPaid ? <icons.Check className="text-green-500 mr-2" /> : <icons.X className="text-red-400 mr-2" />}
                    <span className="font-mono">{formatAddress(payer)}</span>
                    {payer === account?.address && <span className="text-blue-400 ml-2 text-xs">(You)</span>}
                  </span>
                  <span className={`text-sm font-medium ${hasPaid ? 'text-green-400' : 'text-gray-300'}`}>
                    {amount.toFixed(2)} SUI
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showContribute && !request.userContributed && (
        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">Payment will be sent directly to recipient</div>
          <button
            onClick={() => handleContributeToPayment(request.id, request.userAmount)}
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all font-medium shadow-lg"
          >
            Pay {request.userAmount.toFixed(2)} SUI
          </button>
        </div>
      )}

      {showManage && (
        <div className="flex justify-end pt-4 border-t border-gray-700">
          <button
            onClick={() => handleCancelPayment(request.id)}
            className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-2 rounded-lg hover:from-red-700 hover:to-red-800 transition-all font-medium shadow-lg"
          >
            Cancel Request
          </button>
        </div>
      )}
    </div>
);

  const InputField = ({ label, value, onChange, placeholder, type = "text", error }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 bg-gray-800/50 border ${error ? 'border-red-500' : 'border-gray-700'} rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-center shadow-2xl max-w-md w-full">
          <icons.Wallet className="mx-auto mb-6 text-blue-400" />
          <h1 className="text-3xl font-bold text-white mb-4">Split SUI</h1>
          <p className="text-gray-300 mb-8">Connect your wallet to start splitting SUI payments</p>
          <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-lg">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Split SUI</h1>
              <p className="text-gray-300">Send SUI to multiple recipients or create group payment requests</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-400">Connected</p>
                <p className="font-mono text-blue-400">{account?.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : 'Demo Account'}</p>
              </div>
              <button className="bg-red-600/20 text-red-400 px-4 py-2 rounded-lg hover:bg-red-600/30 transition-all">
                Disconnect
              </button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-2xl p-2 mb-8 shadow-xl">
          <div className="flex flex-wrap gap-2">
            <TabButton id="multi-send" label="Multi-Send" active={activeTab === 'multi-send'} onClick={setActiveTab} />
            <TabButton id="create-group" label="Create Group Payment" active={activeTab === 'create-group'} onClick={setActiveTab} />
            <TabButton id="contribute" label="Contribute" active={activeTab === 'contribute'} onClick={setActiveTab} />
            <TabButton id="manage" label="Manage Requests" active={activeTab === 'manage'} onClick={setActiveTab} />
            <TabButton id="transactions" label="Transaction History" active={activeTab === 'transactions'} onClick={setActiveTab} />
          </div>
        </div>

        {/* CSV Import Modal */}
        {showCsvModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">CSV Import Preview</h2>
              {csvError && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <icons.AlertCircle className="text-red-400 mr-2" />
                    <p className="text-red-300">{csvError}</p>
                  </div>
                </div>
              )}
              {csvPreview && csvPreview.length > 0 && (
                <div className="mb-6">
                  <p className="text-gray-300 mb-4">Found {csvPreview.length} valid entries:</p>
                  <div className="bg-gray-700/30 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {csvPreview.slice(0, 10).map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-600 last:border-b-0">
                        <span className="font-mono text-sm text-gray-300">{`${item.address.slice(0, 10)}...${item.address.slice(-6)}`}</span>
                        <span className="text-blue-400 font-medium">{item.amount} SUI</span>
                      </div>
                    ))}
                    {csvPreview.length > 10 && (
                      <p className="text-gray-400 text-sm mt-2">... and {csvPreview.length - 10} more entries</p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={cancelCSVImport}
                  className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                >
                  Cancel
                </button>
                {csvPreview && csvPreview.length > 0 && (
                  <button
                    onClick={confirmCSVImport}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                  >
                    Import {csvPreview.length} Entries
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 shadow-xl">
          {activeTab === 'multi-send' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Multi-Send SUI</h2>
                  <p className="text-gray-300">Send SUI to multiple recipients in a single transaction</p>
                </div>
                <div className="flex gap-3">
                  <label className="bg-gray-700/50 text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-700 transition-all cursor-pointer flex items-center">
                    <icons.Upload className="mr-2" />
                    Import CSV
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={(e) => handleFileInputChange(e, 'multi-send')}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={addRecipient}
                    className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-600/30 transition-all flex items-center"
                  >
                    <icons.Plus className="mr-2" />
                    Add Recipient
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {recipients.map((recipient, index) => (
                  <div key={index} className="bg-gray-700/30 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                      <InputField
                        label="Recipient Address"
                        value={recipient.address}
                        onChange={(value) => updateRecipient(index, 'address', value)}
                        placeholder="0x..."
                      />
                    </div>
                    <div className="w-full md:w-48">
                      <InputField
                        label="Amount (SUI)"
                        value={recipient.amount}
                        onChange={(value) => updateRecipient(index, 'amount', value)}
                        placeholder="0.0"
                        type="number"
                      />
                    </div>
                    <button
                      onClick={() => removeRecipient(index)}
                      className="bg-red-600/20 text-red-400 p-2 rounded-lg hover:bg-red-600/30 transition-all h-fit"
                      disabled={recipients.length === 1}
                    >
                      <icons.Trash />
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-gray-700/30 rounded-lg p-4 flex justify-between items-center">
                <span className="text-gray-300">Total Amount:</span>
                <span className="text-2xl font-bold text-blue-400">{totalAmount.toFixed(2)} SUI</span>
              </div>

              <button
                onClick={handleMultiSend}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-bold text-lg shadow-lg"
              >
                Send to {recipients.filter(r => r.address && r.amount).length} Recipients
              </button>
            </div>
          )}

          {activeTab === 'create-group' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Create Group Payment</h2>
                  <p className="text-gray-300">Create a payment request for multiple contributors</p>
                </div>
                <div className="flex gap-3">
                  <label className="bg-gray-700/50 text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-700 transition-all cursor-pointer flex items-center">
                    <icons.Upload className="mr-2" />
                    Import CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => handleFileInputChange(e, 'group')}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={addPayer}
                    className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-600/30 transition-all flex items-center"
                  >
                    <icons.Plus className="mr-2" />
                    Add Payer
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <InputField
                  label="Recipient Address"
                  value={recipient}
                  onChange={setRecipient}
                  placeholder="0x..."
                />
                <InputField
                  label="Description (Optional)"
                  value={description}
                  onChange={setDescription}
                  placeholder="Dinner bill, gift, etc."
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Payers</h3>
                {payers.map((payer, index) => (
                  <div key={index} className="bg-gray-700/30 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                      <InputField
                        label="Payer Address"
                        value={payer.address}
                        onChange={(value) => updatePayer(index, 'address', value)}
                        placeholder="0x..."
                      />
                    </div>
                    <div className="w-full md:w-48">
                      <InputField
                        label="Amount (SUI)"
                        value={payer.amount}
                        onChange={(value) => updatePayer(index, 'amount', value)}
                        placeholder="0.0"
                        type="number"
                      />
                    </div>
                    <button
                      onClick={() => removePayer(index)}
                      className="bg-red-600/20 text-red-400 p-2 rounded-lg hover:bg-red-600/30 transition-all h-fit"
                      disabled={payers.length === 1}
                    >
                      <icons.Trash />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCreateGroupPayment}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-bold text-lg shadow-lg"
              >
                Create Payment Request
              </button>
            </div>
          )}

          {activeTab === 'contribute' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Contribute to Group Payments</h2>
                <p className="text-gray-300">Payment requests where you are listed as a contributor</p>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                  <p className="text-gray-300">Loading payment requests...</p>
                </div>
              ) : paymentRequests.length === 0 ? (
                <div className="text-center py-12">
                  <icons.AlertCircle className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-300">No payment requests found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {paymentRequests.map((request) => (
                    <PaymentRequestCard key={request.id} request={request} showContribute={true} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Manage Payment Requests</h2>
                <p className="text-gray-300">Payment requests you have created</p>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                  <p className="text-gray-300">Loading your requests...</p>
                </div>
              ) : createdRequests.length === 0 ? (
                <div className="text-center py-12">
                  <icons.AlertCircle className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-300">No payment requests created yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {createdRequests.map((request) => (
                    <PaymentRequestCard key={request.id} request={request} showManage={true} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Transaction History</h2>
                <p className="text-gray-300">Your recent Split SUI transactions</p>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                  <p className="text-gray-300">Loading transactions...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <icons.AlertCircle className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-300">No transactions found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.map((txn, index) => (
                    <div key={index} className="bg-gray-700/30 rounded-lg p-4">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <h3 className="font-semibold text-white">{txn.type}</h3>
                          <a href={`https://suiscan.xyz/testnet/tx/${txn.digest}`} className="text-sm text-gray-400">{txn.digest.slice(0, 20)}...</a>
                          <p className="text-sm text-gray-400">{txn.timestamp}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            txn.status === 'Success' 
                              ? 'bg-green-900/30 text-green-300' 
                              : 'bg-red-900/30 text-red-300'
                          }`}>
                            {txn.status}
                          </span>
                          <span className="text-sm text-gray-400">
                            Gas: {typeof txn.gasUsed === 'number' ? (txn.gasUsed / 1000000000).toFixed(6) : txn.gasUsed} SUI
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}