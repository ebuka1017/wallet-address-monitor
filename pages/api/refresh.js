import { monitor } from '../../utils/monitor';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const success = await monitor();
    
    if (success) {
      return res.status(200).json({ 
        status: 'success',
        message: 'Manual refresh completed successfully'
      });
    } else {
      throw new Error('Failed to complete refresh');
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message });
  }
}