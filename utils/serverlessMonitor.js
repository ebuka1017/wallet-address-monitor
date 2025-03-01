// utils/serverlessMonitor.js
import supabase from '../lib/supabase';
import { 
  determineBlockchain, 
  getCurrentBlock, 
  determineDestination,
  fetchSuspiciousAddresses
} from '../lib/blockchain';
import { fetchBitcoinTransactions, fetchEthereumTransactions } from '../lib/transaction';
import { sendEmail } from '../lib/email';
import { validateTransaction, isValidAddress, sanitizeAddress } from '../utils/validation';

/**
 * Serverless-compatible monitoring function
 * Designed to work with Vercel cron jobs
 */
export async function serverlessMonitor() {
  console.log('Starting serverless monitoring run:', new Date().toISOString());
  
  try {
    // Track monitoring state in database instead of global variables
    const { data: monitorState, error: stateError } = await supabase
      .from('monitor_state')
      .select('*')
      .single();
    
    if (stateError && stateError.code !== 'PGRST116') {
      console.error('Error fetching monitor state:', stateError);
    }
    
    // Create monitor state if it doesn't exist
    if (!monitorState) {
      await supabase
        .from('monitor_state')
        .insert({
          is_active: true,
          last_run: new Date().toISOString(),
          status: 'running'
        });
    } else {
      // Update monitor state
      await supabase
        .from('monitor_state')
        .update({
          last_run: new Date().toISOString(),
          status: 'running'
        })
        .eq('id', monitorState.id);
    }
    
    // Fetch and store suspicious addresses
    const suspiciousAddresses = await fetchSuspiciousAddresses();
    
    for (const addr of suspiciousAddresses) {
      const blockchain = determineBlockchain(addr);
      const sanitizedAddress = sanitizeAddress(addr);
      
      if (blockchain && isValidAddress(sanitizedAddress, blockchain)) {
        await supabase
          .from('addresses')
          .upsert({
            address: sanitizedAddress,
            blockchain: blockchain,
            last_checked_block: 0
          }, {
            onConflict: 'address'
          });
      }
    }
    
    // Get all addresses to monitor
    const { data: allAddresses, error: addressError } = await supabase
      .from('addresses')
      .select('*');
      
    if (addressError) {
      throw new Error(`Error fetching addresses: ${addressError.message}`);
    }
    
    // Process addresses in smaller batches to avoid timeout
    const addressBatches = [];
    for (let i = 0; i < allAddresses.length; i += 5) {
      addressBatches.push(allAddresses.slice(i, i + 5));
    }
    
    for (const addressBatch of addressBatches) {
      await Promise.all(addressBatch.map(async (addr) => {
        const blockchain = addr.blockchain;
        const address = addr.address;
        const lastBlock = addr.last_checked_block || 0;
        const currentBlock = await getCurrentBlock(blockchain);
        
        if (!currentBlock) {
          console.log(`Could not get current block for ${blockchain}`);
          return;
        }
        
        let transactions = [];
        
        if (blockchain === 'bitcoin') {
          transactions = await fetchBitcoinTransactions(address, lastBlock);
        } else if (blockchain === 'ethereum') {
          transactions = await fetchEthereumTransactions(address, lastBlock);
        }
        
        // Process transactions
        for (const tx of transactions) {
          let txDetails;
          
          if (blockchain === 'bitcoin') {
            const destinations = tx.outputs.map(out => out.scriptpubkey_address);
            const amount = tx.outputs.reduce((sum, out) => sum + out.value / 1e8, 0);
            
            // Check destinations for known entities
            let destination = 'Unknown';
            for (const dest of destinations) {
              if (!dest) continue;
              
              const label = await determineDestination(dest);
              if (label !== 'Unknown') {
                destination = label;
                break;
              }
            }
            
            txDetails = {
              blockchain: 'bitcoin',
              from_address: address,
              to_address: destinations.filter(Boolean).join(', '),
              amount: amount,
              token_name: 'BTC',
              tx_hash: tx.hash,
              block_number: tx.block_height,
              destination: destination,
              timestamp: new Date().toISOString()
            };
          } else if (blockchain === 'ethereum') {
            const toAddress = tx.to?.toLowerCase();
            if (!toAddress) continue;
            
            const destination = await determineDestination(toAddress);
            
            txDetails = {
              blockchain: 'ethereum',
              from_address: address,
              to_address: toAddress,
              amount: tx.value,
              token_name: 'ETH',
              tx_hash: tx.hash,
              block_number: tx.block_number,
              destination: destination,
              timestamp: new Date().toISOString()
            };
          }
          
          // Validate transaction before inserting
          if (txDetails && validateTransaction(txDetails)) {
            // Check if transaction already exists to avoid duplicates
            const { data: existingTx } = await supabase
              .from('transactions')
              .select('id')
              .eq('tx_hash', txDetails.tx_hash)
              .single();
            
            if (!existingTx) {
              await supabase.from('transactions').insert(txDetails);
              await sendEmail(txDetails);
            }
          }
        }
        
        // Update last checked block
        if (currentBlock) {
          await supabase
            .from('addresses')
            .update({ last_checked_block: currentBlock })
            .eq('address', address);
        }
      }));
    }
    
    // Update monitor state
    if (monitorState) {
      await supabase
        .from('monitor_state')
        .update({
          status: 'completed',
          last_completed: new Date().toISOString()
        })
        .eq('id', monitorState.id);
    }
    
    console.log('Serverless monitoring run completed');
    return true;
  } catch (error) {
    console.error('Error during serverless monitoring:', error);
    
    // Update monitor state with error
    const { data: monitorState } = await supabase
      .from('monitor_state')
      .select('*')
      .single();
    
    if (monitorState) {
      await supabase
        .from('monitor_state')
        .update({
          status: 'error',
          last_error: error.message,
          last_error_time: new Date().toISOString()
        })
        .eq('id', monitorState.id);
    }
    
    return false;
  }
}