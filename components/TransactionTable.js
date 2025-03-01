import React from 'react';

const TransactionTable = ({ transactions }) => {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="transaction-container">
        <p>No transactions detected yet</p>
      </div>
    );
  }

  return (
    <div className="transaction-container">
      <div className="table-responsive">
        <table className="transaction-table">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
              <th>Token</th>
              <th>Destination</th>
              <th>Tx Hash</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.tx_hash}>
                <td className="address-cell">
                  <span className="ellipsis" title={tx.from_address}>
                    {tx.from_address}
                  </span>
                </td>
                <td className="address-cell">
                  <span className="ellipsis" title={tx.to_address}>
                    {tx.to_address}
                  </span>
                </td>
                <td>{typeof tx.amount === 'number' ? tx.amount.toFixed(6) : tx.amount}</td>
                <td>{tx.token_name}</td>
                <td>
                  <span className={`destination ${tx.destination !== 'Unknown' ? 'known' : ''}`}>
                    {tx.destination}
                  </span>
                </td>
                <td className="hash-cell">
                  <span className="ellipsis" title={tx.tx_hash}>
                    {tx.tx_hash}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .transaction-container {
          margin: 1rem 0;
          overflow-x: auto;
        }
        .transaction-table {
          width: 100%;
          border-collapse: collapse;
        }
        .transaction-table th,
        .transaction-table td {
          border: 1px solid #ddd;
          padding: 0.5rem;
          text-align: left;
        }
        .transaction-table th {
          background-color: #f2f2f2;
        }
        .transaction-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .transaction-table tr:hover {
          background-color: #f0f0f0;
        }
        .address-cell, .hash-cell {
          max-width: 150px;
        }
        .ellipsis {
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .destination {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          background-color: #f0f0f0;
        }
        .destination.known {
          background-color: #e8f5e9;
          color: #2e7d32;
        }
      `}</style>
    </div>
  );
};

export default TransactionTable;