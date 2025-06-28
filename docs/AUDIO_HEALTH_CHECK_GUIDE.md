# Audio Service Health Check Endpoint

## Overview

The health check endpoint provides real-time status information about the audio processing service and its dependencies.

## Endpoint Details

### URL
```
GET /api/v1/audio/health
```

### Authentication
- **Required**: Yes
- **Header**: `X-API-Key: {CLOUD_API_KEY}`
- **Same authentication as the main audio processing endpoint**

### Timeout
- Maximum response time: 5 seconds
- Internal checks have a 3-second timeout for AI service verification

## Response Format

### Success Response (200 OK)
```json
{
  "status": "ok",
  "message": "Audio processing service is healthy",
  "timestamp": "2024-01-20T12:00:00.000Z",
  "services": {
    "server": "healthy",
    "database": "connected",
    "ai": "connected",
    "embeddings": "available"
  }
}
```

### Degraded Service Response (503 Service Unavailable)
```json
{
  "status": "error",
  "message": "Service degraded: ai, embeddings not available",
  "timestamp": "2024-01-20T12:00:00.000Z",
  "services": {
    "server": "healthy",
    "database": "connected",
    "ai": "disconnected",
    "embeddings": "unavailable"
  }
}
```

### Unauthorized Response (401 Unauthorized)
```json
{
  "error": {
    "code": "AUTH001",
    "message": "API key inválida o no proporcionada",
    "type": "AUTHENTICATION",
    "timestamp": "2024-01-20T12:00:00.000Z"
  }
}
```

## Service Checks

The health check verifies the following components:

### 1. Server
- **Status**: Always `healthy` if the endpoint responds
- **Description**: Basic server availability

### 2. Database
- **Status**: `connected` or `disconnected`
- **Check**: Executes a simple `SELECT 1` query
- **Purpose**: Verifies PostgreSQL connection and accessibility

### 3. AI Service (Gemini)
- **Status**: `connected` or `disconnected`
- **Check**: Sends a simple test prompt to Gemini API
- **Timeout**: 3 seconds
- **Purpose**: Verifies AI service is accessible and responding

### 4. Embeddings
- **Status**: `available` or `unavailable`
- **Check**: Verifies that product embeddings exist in the database
- **Purpose**: Ensures semantic search functionality is available

## Implementation Examples

### cURL
```bash
curl -X GET https://api.example.com/api/v1/audio/health \
  -H "X-API-Key: your-cloud-api-key"
```

### JavaScript/TypeScript
```typescript
async function checkServiceHealth(apiUrl: string, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/v1/audio/health`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    const data = await response.json();
    
    if (response.ok && data.status === 'ok') {
      console.log('Service is healthy');
      return true;
    } else {
      console.warn('Service degraded:', data.message);
      return false;
    }
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

// Usage with retry
async function monitorServiceHealth(apiUrl: string, apiKey: string) {
  const isHealthy = await checkServiceHealth(apiUrl, apiKey);
  
  if (!isHealthy) {
    // Implement retry logic or alerting
    console.error('Service is not healthy, consider failover');
  }
}
```

### Python
```python
import requests
from typing import Dict, Optional

def check_health(api_url: str, api_key: str, timeout: int = 5) -> Dict:
    """
    Check the health of the audio processing service.
    
    Returns:
        dict: Health check response
    """
    headers = {
        'X-API-Key': api_key
    }
    
    try:
        response = requests.get(
            f"{api_url}/api/v1/audio/health",
            headers=headers,
            timeout=timeout
        )
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 401:
            raise Exception("Invalid API key")
        else:
            return response.json()
            
    except requests.exceptions.Timeout:
        return {
            "status": "error",
            "message": "Health check timeout"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

# Usage
health = check_health("https://api.example.com", "your-api-key")
if health.get("status") == "ok":
    print("Service is healthy")
else:
    print(f"Service issue: {health.get('message')}")
```

## Monitoring Best Practices

### 1. Polling Frequency
- **Recommended**: Every 30-60 seconds
- **Minimum**: Every 10 seconds (to avoid rate limiting)
- **Maximum**: Every 5 minutes

### 2. Alerting Thresholds
- **Immediate Alert**: 3 consecutive failures
- **Warning**: 2 consecutive failures
- **Recovery**: 2 consecutive successes after failure

### 3. Circuit Breaker Pattern
```typescript
class HealthCheckCircuitBreaker {
  private failures = 0;
  private lastCheck = 0;
  private isOpen = false;
  
  async checkHealth(): Promise<boolean> {
    // Skip if circuit is open and cooldown hasn't passed
    if (this.isOpen && Date.now() - this.lastCheck < 30000) {
      return false;
    }
    
    try {
      const healthy = await performHealthCheck();
      
      if (healthy) {
        this.failures = 0;
        this.isOpen = false;
        return true;
      } else {
        this.failures++;
        if (this.failures >= 3) {
          this.isOpen = true;
        }
        return false;
      }
    } finally {
      this.lastCheck = Date.now();
    }
  }
}
```

## Status Codes

| Status Code | Meaning |
|-------------|---------|
| 200 | Service is fully operational |
| 401 | Authentication failed - invalid or missing API key |
| 503 | Service is degraded - one or more dependencies are down |
| 500 | Internal server error - health check itself failed |

## Logging

The health check logs the following information:

- **Debug level**: Individual service check results
- **Info level**: Overall health check completion with response time
- **Error level**: Failed service checks with error details

Example log output:
```
[DEBUG] Health check: Database connected
[DEBUG] Health check: AI service connected
[DEBUG] Health check: Embeddings available (count: 150)
[INFO] Health check completed { status: 'ok', services: {...}, responseTime: 245 }
```

## Integration with Monitoring Systems

### Prometheus Metrics Format
```typescript
// Convert health check to Prometheus metrics
function toPrometheusMetrics(health: HealthCheckResponse): string {
  const metrics = [];
  
  // Overall status
  metrics.push(`audio_service_health{status="${health.status}"} ${health.status === 'ok' ? 1 : 0}`);
  
  // Individual services
  metrics.push(`audio_service_database{} ${health.services.database === 'connected' ? 1 : 0}`);
  metrics.push(`audio_service_ai{} ${health.services.ai === 'connected' ? 1 : 0}`);
  metrics.push(`audio_service_embeddings{} ${health.services.embeddings === 'available' ? 1 : 0}`);
  
  return metrics.join('\n');
}
```

### CloudWatch Custom Metrics
```typescript
// Send to AWS CloudWatch
async function sendToCloudWatch(health: HealthCheckResponse) {
  const cloudwatch = new AWS.CloudWatch();
  
  await cloudwatch.putMetricData({
    Namespace: 'AudioService',
    MetricData: [
      {
        MetricName: 'HealthStatus',
        Value: health.status === 'ok' ? 1 : 0,
        Timestamp: new Date(health.timestamp)
      },
      {
        MetricName: 'DatabaseConnection',
        Value: health.services.database === 'connected' ? 1 : 0,
        Timestamp: new Date(health.timestamp)
      }
    ]
  }).promise();
}
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Verify API key is correct
   - Check header name is exactly `X-API-Key`
   - Ensure API key has necessary permissions

2. **503 with AI disconnected**
   - Check Gemini API key configuration
   - Verify network connectivity to Google AI services
   - Check for Gemini API quota limits

3. **503 with embeddings unavailable**
   - Run embedding generation script
   - Verify pgvector extension is enabled
   - Check Product table has embedding data

4. **Timeout errors**
   - Increase client-side timeout beyond 5 seconds
   - Check network latency
   - Verify server resources are not exhausted