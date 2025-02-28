import os
import requests
import mailersend
from moralis import streams, wallets
from dotenv import load_dotenv
from supabase import create_client, Client
from flask import Flask, render_template, jsonify, request
from apscheduler.schedulers.background import BackgroundScheduler
from threading import Thread

# Load environment variables
load_dotenv()

# Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GETBLOCK_BTC_URL = os.getenv("GETBLOCK_BTC_URL")
GETBLOCK_ETH_URL = os.getenv("GETBLOCK_ETH_URL")
MAILERSEND_API_KEY = os.getenv("MAILERSEND_API_KEY")
MAILERSEND_DOMAIN = os.getenv("MAILERSEND_DOMAIN")
RECEIVER_EMAIL = os.getenv("RECEIVER_EMAIL")
MORALIS_API_KEY = os.getenv("MORALIS_API_KEY")

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize Flask app and scheduler
app = Flask(__name__)
scheduler = BackgroundScheduler()
scheduler.start()

# Fetch suspicious addresses
def fetch_suspicious_addresses():
    url = "https://hackscan.hackbounty.io/public/hack-address.json"
    response = requests.get(url)
    return response.json()

# Determine blockchain
def determine_blockchain(address: str) -> str:
    address = address.lower()
    if address.startswith("bc1") or address.startswith("1") or address.startswith("3"):
        return "bitcoin"
    elif address.startswith("0x"):
        return "ethereum"
    return None

# Get current block number
def get_current_block(blockchain: str) -> int:
    if blockchain == "bitcoin":
        response = requests.get(f"{GETBLOCK_BTC_URL}/blocks/tip/height")
        return int(response.text)
    else:
        url = GETBLOCK_ETH_URL
        payload = {"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1}
        response = requests.post(url, json=payload)
        return int(response.json()["result"], 16)

# Fetch Bitcoin transactions
def fetch_bitcoin_transactions(address: str, last_block: int) -> list:
    response = requests.get(f"{GETBLOCK_BTC_URL}/address/{address}")
    txs = response.json().get("txids", [])[:10]
    outgoing = []
    for tx_hash in txs:
        tx_response = requests.get(f"{GETBLOCK_BTC_URL}/tx/{tx_hash}")
        tx_data = tx_response.json()
        block_height = tx_data.get("block_height", 0)
        if block_height <= last_block:
            continue
        if any(vin.get("prevout", {}).get("scriptpubkey_address") == address for vin in tx_data.get("vin", [])):
            outgoing.append({
                "hash": tx_hash,
                "block_height": block_height,
                "outputs": tx_data.get("vout", [])
            })
    return outgoing

# Fetch Ethereum transactions
def fetch_ethereum_transactions(address: str, start_block: int) -> list:
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_getLogs",
        "params": [{"fromBlock": hex(start_block), "toBlock": "latest", "address": address}],
        "id": 1
    }
    response = requests.post(GETBLOCK_ETH_URL, json=payload)
    logs = response.json().get("result", [])
    outgoing = []
    for log in logs:
        tx_hash = log["transactionHash"]
        tx_response = requests.post(GETBLOCK_ETH_URL, json={
            "jsonrpc": "2.0",
            "method": "eth_getTransactionByHash",
            "params": [tx_hash],
            "id": 2
        })
        tx_data = tx_response.json().get("result", {})
        if tx_data.get("from", "").lower() == address.lower():
            outgoing.append({
                "hash": tx_hash,
                "block_number": int(log["blockNumber"], 16),
                "to": tx_data.get("to"),
                "value": int(tx_data.get("value", "0x0"), 16) / 1e18
            })
    return outgoing

# Determine destination
def determine_destination(to_address: str) -> str:
    url = f"https://deep-index.moralis.io/api/v2/wallet/{to_address}/labels"
    headers = {"accept": "application/json", "X-API-Key": MORALIS_API_KEY}
    response = requests.get(url, headers=headers)
    if response.status_code == 200 and "labels" in response.json():
        labels = response.json()["labels"]
        return labels[0]["name"] if labels else "Unknown"
    return "Unknown"

# Send email alert
def send_email(details: dict):
    mailersend_url = "https://api.mailersend.com/v1/email"
    headers = {
        "Authorization": f"Bearer {MAILERSEND_API_KEY}",
        "Content-Type": "application/json"
    }
    email_data = {
        "from": {"email": f"noreply@{MAILERSEND_DOMAIN}"},
        "to": [{"email": RECEIVER_EMAIL}],
        "subject": "Suspicious Transaction Detected",
        "text": (
            f"Fund Destination: {details['destination']}\n"
            f"Destination Address: {details['to_address']}\n"
            f"Token Amount: {details['amount']}\n"
            f"Token Name: {details['token_name']}\n"
            f"Tx Hash: {details['blockchain']}:{details['tx_hash']}#{details['block_number']}"
        )
    }
    response = requests.post(mailersend_url, headers=headers, json=email_data)
    if response.status_code == 202:
        print("Email sent successfully")
    else:
        print(f"Failed to send email: {response.text}")

# Monitoring function
def monitor():
    print("Starting monitoring run...")
    addresses = fetch_suspicious_addresses()
    for addr in addresses:
        blockchain = determine_blockchain(addr)
        if blockchain:
            supabase.table("addresses").upsert(
                {"address": addr.lower(), "blockchain": blockchain, "last_checked_block": 0}
            ).execute()

    all_addresses = supabase.table("addresses").select("*").execute().data
    for addr in all_addresses:
        blockchain = addr["blockchain"]
        address = addr["address"]
        last_block = addr.get("last_checked_block", 0)
        current_block = get_current_block(blockchain)

        if blockchain == "bitcoin":
            txs = fetch_bitcoin_transactions(address, last_block)
            for tx in txs:
                amount = sum(out["value"] / 1e8 for out in tx["outputs"])
                destinations = [out["scriptpubkey_address"] for out in tx["outputs"]]
                destination = "Unknown"
                for dest in destinations:
                    label = determine_destination(dest)
                    if label != "Unknown":
                        destination = label
                        break
                details = {
                    "blockchain": "bitcoin",
                    "from_address": address,
                    "to_address": ", ".join(destinations),
                    "amount": amount,
                    "token_name": "BTC",
                    "tx_hash": tx["hash"],
                    "block_number": tx["block_height"],
                    "destination": destination
                }
                supabase.table("transactions").insert(details).execute()
                send_email(details)
        else:  # Ethereum
            txs = fetch_ethereum_transactions(address, last_block)
            for tx in txs:
                to_address = tx["to"].lower()
                destination = determine_destination(to_address)
                details = {
                    "blockchain": "ethereum",
                    "from_address": address,
                    "to_address": to_address,
                    "amount": tx["value"],
                    "token_name": "ETH",
                    "tx_hash": tx["hash"],
                    "block_number": tx["block_number"],
                    "destination": destination
                }
                supabase.table("transactions").insert(details).execute()
                send_email(details)

        if current_block:
            supabase.table("addresses").update(
                {"last_checked_block": current_block}
            ).eq("address", address).execute()

# Flask Routes
@app.route('/')
def index():
    addresses = supabase.table("addresses").select("*").execute().data
    transactions = supabase.table("transactions").select("*").order("block_number", desc=True).limit(10).execute().data
    return render_template('index.html', addresses=addresses, transactions=transactions)

@app.route('/start', methods=['POST'])
def start_monitoring():
    if not scheduler.get_job('monitor'):
        scheduler.add_job(monitor, 'interval', minutes=5, id='monitor')
    return jsonify({"status": "started"})

@app.route('/stop', methods=['POST'])
def stop_monitoring():
    if scheduler.get_job('monitor'):
        scheduler.remove_job('monitor')
    return jsonify({"status": "stopped"})

@app.route('/refresh', methods=['POST'])
def refresh_monitoring():
    # Run monitor in a thread to avoid blocking the server
    Thread(target=monitor).start()
    return jsonify({"status": "refreshed"})

@app.route('/data')
def get_data():
    addresses = supabase.table("addresses").select("*").execute().data
    transactions = supabase.table("transactions").select("*").order("block_number", desc=True).limit(10).execute().data
    return jsonify({"addresses": addresses, "transactions": transactions})

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()

if __name__ == '__main__':
    try:
        app.run(debug=True)
    finally:
        shutdown_scheduler()
