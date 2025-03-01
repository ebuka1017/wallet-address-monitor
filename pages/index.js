import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AddressList from '../components/AddressList';
import TransactionTable from '../components/TransactionTable';

export default function Home() {
  const [addresses, setAddresses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data on load
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/data');
      setAddresses(response.data.addresses || []);
      setTransactions(response.data.transactions || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setIsLoading(false);
    }
  };

  const startMonitoring = async () => {
    try {
      const response = await axios.post('/api/start', { interval: refreshInterval });
      if (response.data.status === 'started' || response.data.status === 'already_running') {
        setIsMonitoring(true);
      }
    } catch (error) {
      console.error('Error starting monitoring:', error);
    }
  };

  const stopMonitoring = async () => {
    try {
      const response = await axios.post('/api/stop');
      if (response.data.status === 'stopped' || response.data.status === 'not_running') {
        setIsMonitoring(false);
      }
    } catch (error) {
      console.error('Error stopping monitoring:', error);
    }
  };

  const refreshData = async () => {
    try {
      await axios.post('/api/refresh');
      fetchData();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Wallet Address Monitor</h1>
        <p>Track transactions from suspicious wallet addresses</p>
      </header>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="interval">Refresh Interval (minutes):</label>
          <input
            type="number"
            id="interval"
            min="1"
            max="60"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 5)}
            disabled={isMonitoring}
          />
        </div>
        
        <div className="button-group">
          {!isMonitoring ? (
            <button onClick={startMonitoring} className="start-btn">Start Monitoring</button>
          ) : (
            <button onClick={stopMonitoring} className="stop-btn">Stop Monitoring</button>
          )}
          <button onClick={refreshData} className="refresh-btn">Manual Refresh</button>
        </div>
      </div>

      <div className="content">
        <section>
          <h2>Monitored Addresses</h2>
          {isLoading ? <p>Loading addresses...</p> : <AddressList addresses={addresses} />}
        </section>

        <section>
          <h2>Detected Transactions</h2>
          {isLoading ? <p>Loading transactions...</p> : <TransactionTable transactions={transactions} />}
        </section>
      </div>

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
        }
        header {
          margin-bottom: 2rem;
          border-bottom: 1px solid #eaeaea;
          padding-bottom: 1rem;
        }
        h1 {
          margin: 0;
          font-size: 2rem;
        }
        .controls {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 2rem;
          padding: 1rem;
          background-color: #f9f9f9;
          border-radius: 4px;
        }
        .control-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .button-group {
          display: flex;
          gap: 0.5rem;
          margin-left: auto;
        }
        button {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        .start-btn {
          background-color: #4caf50;
          color: white;
        }
        .stop-btn {
          background-color: #f44336;
          color: white;
        }
        .refresh-btn {
          background-color: #2196f3;
          color: white;
        }
        input {
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          width: 60px;
        }
        section {
          margin-bottom: 2rem;
        }
        h2 {
          margin-top: 0;
          border-bottom: 1px solid #eaeaea;
          padding-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}