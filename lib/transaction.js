// lib/transaction.js (optimized version)
import axios from 'axios';
import getConfig from 'next/config';

const { serverRuntimeConfig } = getConfig();

/**
 * Fetch Bitcoin transactions for a specified address with batch processing
 * @param {string} address - Bitcoin address to monitor
 * @param {number} lastBlock - Last block that was checked
 * @returns {Promise<Array>} Array of outgoing transactions
 */
export async function fetchBitcoinTransactions(address, lastBlock) {
  try {
    // Get transaction IDs for the address
    const response = await axios.get(`${serverRuntimeConfig.GETBLOCK_BTC_URL}/address/${address}`);
    let txids = response.data?.txids || [];
    
    // Only process the most recent transactions (limit to 20 for efficiency)
    txids = txids.slice(0, 20);
    
    if (txids.length === 0) {
      return [];
    }
    
    // Batch process transactions - use Promise.all for parallel processing
    const txPromises = txids.map(txid => 
      axios.get(`${serverRuntimeConfig.GETBLOCK_BTC_URL}/tx/${txid}`)
    );
    
    const txResponses = await Promise.all(txPromises);
    const transactions = txResponses.map(response => response.data);
    
    // Filter transactions
    const outgoing = transactions
      .filter(tx => {
        // Check if this is an outgoing transaction (address is in inputs)
        const isOutgoing = tx.vin?.some(vin => 
          vin.prevout?.scriptpubkey_address === address
        );
        // Only include transactions after lastBlock
        const blockHeight = tx.block_height || 0;
        return isOutgoing && blockHeight > lastBlock;
      })
      .map(tx => ({
        hash: tx.txid,
        block_height: tx.block_height || 0,
        outputs: tx.vout || []
      }));
    
    return outgoing;
  } catch (error) {
    console.error('Error fetching Bitcoin transactions:', error);
    return [];
  }
}

/**
 * Fetch Ethereum transactions for a specified address with optimized processing
 * @param {string} address - Ethereum address to monitor
 * @param {number} startBlock - Block to start checking from
 * @returns {Promise<Array>} Array of outgoing transactions
 */
export async function fetchEthereumTransactions(address, startBlock) {
  try {
    const url = serverRuntimeConfig.GETBLOCK_ETH_URL;
    
    // Get current block number first to limit the range
    const blockNumberPayload = {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    };
    
    const blockNumberResponse = await axios.post(url, blockNumberPayload);
    const currentBlock = parseInt(blockNumberResponse.data.result, 16);
    
    // Limit the block range to avoid excessive data (max 1000 blocks at a time)
    const endBlock = Math.min(currentBlock, startBlock + 1000);
    
    // Use eth_getTransactionsByAccount method with batch request
    const payload = {
      jsonrpc: '2.0',
      method: 'eth_getLogs',
      params: [{
        fromBlock: '0x' + startBlock.toString(16),
        toBlock: '0x' + endBlock.toString(16),
        address: address
      }],
      id: 1
    };
    
    const response = await axios.post(url, payload);
    const logs = response.data?.result || [];
    
    if (logs.length === 0) {
      return [];
    }
    
    // Extract unique transaction hashes from logs
    const txHashes = [...new Set(logs.map(log => log.transactionHash))];
    
    // Batch request transaction details
    const txBatchPayload = {
      jsonrpc: '2.0',
      method: 'batch',
      requests: txHashes.map((txHash, index) => ({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [txHash],
        id: index + 1
      }))
    };
    
    const txDetailsResponse = await axios.post(url, txBatchPayload);
    const txDetails = txDetailsResponse.data || [];
    
    // Process transaction details
    const outgoing = txDetails
      .filter(tx => tx.result && tx.result.from?.toLowerCase() === address.toLowerCase())
      .map(tx => ({
        hash: tx.result.hash,
        block_number: parseInt(tx.result.blockNumber, 16),
        to: tx.result.to,
        value: parseInt(tx.result.value || '0x0', 16) / 1e18
      }));
    
    return outgoing;
  } catch (error) {
    console.error('Error fetching Ethereum transactions:', error);
    return [];
  }
}