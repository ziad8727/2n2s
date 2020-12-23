# 2n2s REST API
*I should improve my documenting skills..*
### Base URL: IP:PORT/api/v1/

# Information
## Errors
Errors are returned as a JSON response with a `code` value and `msg` value.

## Authentication
Authentication may be done by sending cookies retreived from `/auth/login` or an `Authorization` header containing `2n2s:PASS` with PASS being your password.

# Endpoints
## POST /start
Start the queue. Returns 204 on success.

## POST /stop
Stop the queue. Returns 204 on success. 

## POST /toggleReconnectOnMiss
Toggle reconnect if client is not present. Returns a JSON payload with a boolean `reconnectOnMiss`.

## GET /status
Get the status of the proxy. Returns a JSON payload.

## GET /history
Get position history (used for the chart).

## POST /auth/login
Submit login credentials. Send a JSON payload with the key `pass` to login. Returns a 204 with cookies.

## GET /auth/ws
Get an authentication token to be used in the WebSocket endpoint.

## WebSocket /ws
Send `{op: 2, token: 'TOKEN'}` once. TOKEN should be the token you received from `/auth/ws`. You will be disconnected with close code 4000 for incorrect authentication, and 4001 for malformed payloads or server errors.
You will receive JSON objects in return containing the same content as `/status`, live.
