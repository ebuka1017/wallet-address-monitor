import os
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
import tkinter as tk
from threading import Thread
from apscheduler.schedulers.blocking import BlockingScheduler


# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GETBLOCK_BTC_URL = "https://go.getblock.io/your-btc-api-key-here"
GETBLOCK_ETH_URL = "https://go.getblock.io/your-eth-api-key-here"
MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
RECEIVER_EMAIL = os.getenv("RECEIVER_EMAIL")
MORALIS_API_KEY = "your-moralis-api-key-here"

# Connect to Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch suspicious addresses from the JSON
def fetch_suspicious_addresses():
    url = "https://hackscan.hackbounty.io/public/hack-address.json"
    response = requests.get(url)
    return response.json()

# Guess the blockchain based on address format
def determine_blockchain(address: str) -> str:
    address = address.lower()
    if address.startswith("bc1") or address.startswith("1") or address.startswith("3"):
        return "bitcoin"
    elif address.startswith("0x"):
        return "ethereum"
    return None

# Get the latest block number
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
    txs = response.json().get("txids", [])[:10]  # Limit to 10 recent txs
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
                "value": int(tx_data.get("value", "0x0"), 16) / 1e18  # Convert wei to ETH
            })
    return outgoing

# Figure out where the funds went
def determine_destination(to_address: str) -> str:
    url = f"https://deep-index.moralis.io/api/v2/wallet/{to_address}/labels"
    headers = {"accept": "application/json", "X-API-Key": MORALIS_API_KEY}
    response = requests.get(url, headers=headers)
    if response.status_code == 200 and "labels" in response.json():
        labels = response.json()["labels"]
        return labels[0]["name"] if labels else "Unknown"
    return "Unknown"

# Send an email alert
def send_email(details: dict):
    mailgun_url = f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages"
    body = (
        f"Fund Destination: {details['destination']}\n"
        f"Destination Address: {details['to_address']}\n"
        f"Token Amount: {details['amount']}\n"
        f"Token Name: {details['token_name']}\n"
        f"Tx Hash: {details['blockchain']}:{details['tx_hash']}#{details['block_number']}"
    )
    requests.post(
        mailgun_url,
        auth=("api", MAILGUN_API_KEY),
        data={
            "from": f"Monitor <mailgun@{MAILGUN_DOMAIN}>",
            "to": RECEIVER_EMAIL,
            "subject": "Suspicious Transaction Detected",
            "text": body
        }
    )

# Main monitoring function
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
                amount = sum(out["value"] / 1e8 for out in tx["outputs"])  # BTC in satoshis
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

# GUI and scheduler setup
scheduler = None
monitoring_thread = None

def start_monitor():
    global scheduler, monitoring_thread
    if scheduler is None or not scheduler.running:
        scheduler = BlockingScheduler()
        scheduler.add_job(monitor, "interval", minutes=5)
        monitoring_thread = Thread(target=scheduler.start, daemon=True)
        monitoring_thread.start()
        status_label.config(text="Monitoring active...")

def stop_monitor():
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown()
        status_label.config(text="Monitoring stopped...")

def refresh_monitor():
    monitor()
    status_label.config(text="Manual refresh done...")

def on_closing():
    stop_monitor()
    root.destroy()

# Main GUI
def main():
    global root, status_label
    root = tk.Tk()
    root.title("Transaction Monitor")
    status_label = tk.Label(root, text="Monitoring stopped...")
    status_label.pack(pady=5)
    tk.Button(root, text="Start", command=start_monitor).pack(pady=5)
    tk.Button(root, text="Stop", command=stop_monitor).pack(pady=5)
    tk.Button(root, text="Refresh", command=refresh_monitor).pack(pady=5)
    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()

if __name__ == "__main__":
    main()