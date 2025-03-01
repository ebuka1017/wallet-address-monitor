import React from 'react';

const AddressList = ({ addresses }) => {
  if (!addresses || addresses.length === 0) {
    return (
      <div className="address-container">
        <p>No addresses being monitored</p>
      </div>
    );
  }

  return (
    <div className="address-container">
      <ul className="address-list">
        {addresses.map((addr) => (
          <li key={addr.address} className="address-item">
            <span className="address">{addr.address}</span>
            <span className="blockchain-badge">{addr.blockchain}</span>
            <span className="last-block">
              Last checked: Block #{addr.last_checked_block || 'Not checked yet'}
            </span>
          </li>
        ))}
      </ul>

      <style jsx>{`
        .address-container {
          margin: 1rem 0;
        }
        .address-list {
          list-style: none;
          padding: 0;
        }
        .address-item {
          display: flex;
          align-items: center;
          padding: 0.5rem;
          border: 1px solid #ddd;
          margin-bottom: 0.5rem;
          border-radius: 4px;
        }
        .address {
          font-family: monospace;
          flex-grow: 1;
          word-break: break-all;
        }
        .blockchain-badge {
          background-color: #f0f0f0;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          margin: 0 0.5rem;
          font-size: 0.8rem;
          text-transform: capitalize;
        }
        .last-block {
          font-size: 0.8rem;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default AddressList;