import supabase from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch addresses
    const { data: addresses, error: addressError } = await supabase
      .from('addresses')
      .select('*');

    if (addressError) {
      throw new Error(`Error fetching addresses: ${addressError.message}`);
    }

    // Fetch recent transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .order('block_number', { ascending: false })
      .limit(10);

    if (txError) {
      throw new Error(`Error fetching transactions: ${txError.message}`);
    }

    // Return data
    return res.status(200).json({
      addresses,
      transactions
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message });
  }
}