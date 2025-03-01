import { startMonitoring, isMonitoringActive } from '../../utils/monitor';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get interval from request or use default
    const intervalMinutes = req.body.interval || 5;
    
    if (isMonitoringActive()) {
      return res.status(200).json({ 
        status: 'already_running',
        message: 'Monitoring is already active'
      });
    }
    
    const success = startMonitoring(intervalMinutes);
    
    if (success) {
      return res.status(200).json({ 
        status: 'started',
        message: 'Monitoring started successfully',
        interval: intervalMinutes
      });
    } else {
      throw new Error('Failed to start monitoring');
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message });
  }
}