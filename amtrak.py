#!/usr/bin/env python3

import requests

BASE_URL = "https://api-v3.amtraker.com/v3"
API_KEY = "a083dc68622b251fd4fa2a63e055c3c9"

def getVehicles():
	url = f"{BASE_URL}/trains"
	response = requests.get(url)
	response.raise_for_status()
	return response.json()