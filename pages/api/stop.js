import { stopMonitoring, isMonitoringActive } from '../../utils/monitor';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!isMonitoringActive()) {
      return res.status(200).json({ 
        status: 'not_running',
        message: 'Monitoring is not currently active'
      });
    }
    
    const success = stopMonitoring();
    
    if (success) {
      return res.status(200).json({ 
        status: 'stopped',
        message: 'Monitoring stopped successfully'
      });
    } else {
      throw new Error('Failed to stop monitoring');
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message });
  }
}