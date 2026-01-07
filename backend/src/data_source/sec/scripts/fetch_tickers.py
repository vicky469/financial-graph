import requests
import pandas as pd
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
SEC_USER_AGENT = os.getenv("SEC_USER_AGENT")

TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json"
OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_JSON = OUTPUT_DIR / "company_tickers.json"
OUTPUT_CSV = OUTPUT_DIR / "company_tickers.csv"

def fetch_tickers():
    print(f"Fetching tickers from {TICKERS_URL}...")
    headers = {
        "User-Agent": SEC_USER_AGENT,
        "Accept-Encoding": "gzip, deflate",
        "Host": "www.sec.gov"
    }

    try:
        response = requests.get(TICKERS_URL, headers=headers)
        response.raise_for_status()
        
        # Parse JSON
        data = response.json()
        
        # The structure is: {"fields": ["cik", "name", "ticker", "exchange"], "data": [[...], [...]]}
        fields = data['fields']
        rows = data['data']
        
        print(f"Successfully fetched {len(rows):,} companies.")
        
        # Ensure output directory exists
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        
        # Save raw JSON
        with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"Saved raw JSON to {OUTPUT_JSON}")
        
        # Convert to DataFrame
        df = pd.DataFrame(rows, columns=fields)
        
        # Rename columns to match our standard convention if needed, or keep raw
        # fields are typically: cik, name, ticker, exchange
        
        # Save to CSV
        df.to_csv(OUTPUT_CSV, index=False)
        print(f"Saved processed CSV to {OUTPUT_CSV}")
        
        # Preview
        print("\nPreview:")
        print(df.head())
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Status Code: {e.response.status_code}")
            print(f"Response: {e.response.text[:200]}")

if __name__ == "__main__":
    fetch_tickers()
