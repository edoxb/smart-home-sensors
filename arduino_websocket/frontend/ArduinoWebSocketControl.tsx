import { useState, useEffect } from 'react'

interface ArduinoWebSocketControlProps {
  sensorName: string
}

interface ArduinoData {
  temperature: number | null
  humidity: number | null
}

export default function ArduinoWebSocketControl({ sensorName }: ArduinoWebSocketControlProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [data, setData] = useState<ArduinoData>({ temperature: null, humidity: null })
  const [serverStarted, setServerStarted] = useState(false)
  const [port, setPort] = useState<number | null>(null)
  const [commandPin, setCommandPin] = useState(13)
  const [commandState, setCommandState] = useState(true)

  const setLoadingState = (action: string, value: boolean) => {
    setLoading(prev => ({ ...prev, [action]: value }))
  }

  // Polling dati ogni 2 secondi
  useEffect(() => {
    if (!serverStarted) return

    const fetchData = async () => {
      try {
        const response = await fetch(`http://localhost:8000/sensors/arduino-websocket/data/${encodeURIComponent(sensorName)}`)
        if (response.ok) {
          const result = await response.json()
          setData({
            temperature: result.temperature,
            humidity: result.humidity
          })
        }
      } catch (error) {
        console.error('Errore fetch dati:', error)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 2000)
    return () => clearInterval(interval)
  }, [sensorName, serverStarted])

  const startServer = async () => {
    setLoadingState('start', true)
    try {
      const response = await fetch(`http://localhost:8000/sensors/arduino-websocket/start/${encodeURIComponent(sensorName)}`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Errore nell\'avvio del server')
      }
      
      const result = await response.json()
      setPort(result.port)
      setServerStarted(true)
    } catch (error) {
      console.error('Errore:', error)
      alert(error instanceof Error ? error.message : 'Errore sconosciuto')
    } finally {
      setLoadingState('start', false)
    }
  }

  const sendCommand = async () => {
    setLoadingState('command', true)
    try {
      const response = await fetch(`http://localhost:8000/sensors/arduino-websocket/command?sensor_name=${encodeURIComponent(sensorName)}&pin=${commandPin}&state=${commandState}`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Errore nell\'invio del comando')
      }
    } catch (error) {
      console.error('Errore:', error)
      alert(error instanceof Error ? error.message : 'Errore sconosciuto')
    } finally {
      setLoadingState('command', false)
    }
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      padding: '3rem',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      color: '#e0e0e0',
      fontFamily: '"Courier New", monospace',
      position: 'relative',
      overflow: 'auto'
    }}>
      {/* Pattern di sfondo tech */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 255, 150, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 255, 150, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        pointerEvents: 'none'
      }} />

      {/* Header con stile tech */}
      <div style={{
        marginBottom: '3rem',
        padding: '2rem',
        background: 'rgba(0, 255, 150, 0.1)',
        border: '2px solid #00ff96',
        borderRadius: '8px',
        boxShadow: '0 0 20px rgba(0, 255, 150, 0.3)',
        position: 'relative',
        zIndex: 1
      }}>
        <h1 style={{
          color: '#00ff96',
          fontSize: '2.5rem',
          margin: 0,
          textShadow: '0 0 10px rgba(0, 255, 150, 0.5)',
          fontFamily: '"Courier New", monospace',
          fontWeight: 'bold',
          letterSpacing: '2px'
        }}>
          ⚡ ARDUINO WEBSOCKET
        </h1>
        <div style={{
          color: '#00ff96',
          fontSize: '1.2rem',
          marginTop: '0.5rem',
          opacity: 0.8
        }}>
          {sensorName.toUpperCase()}
        </div>
      </div>

      {/* Container principale */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '2rem',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Card Dati Sensore - Stile Terminal */}
        <div style={{
          padding: '2rem',
          background: 'rgba(0, 0, 0, 0.6)',
          border: '2px solid #00ff96',
          borderRadius: '8px',
          boxShadow: '0 0 30px rgba(0, 255, 150, 0.2)',
          fontFamily: '"Courier New", monospace'
        }}>
          <div style={{
            color: '#00ff96',
            fontSize: '1.3rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid #00ff96',
            paddingBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            📊 SENSOR DATA
          </div>
          
          {/* Temperatura - Stile LED */}
          <div style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            background: 'rgba(255, 50, 50, 0.15)',
            border: '2px solid #ff3232',
            borderRadius: '8px',
            boxShadow: data.temperature !== null ? '0 0 20px rgba(255, 50, 50, 0.4)' : 'none'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: '#ff3232',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              TEMPERATURE
            </div>
            <div style={{
              fontSize: '3rem',
              fontWeight: 'bold',
              color: data.temperature !== null ? '#ff3232' : '#666',
              textShadow: data.temperature !== null ? '0 0 15px rgba(255, 50, 50, 0.6)' : 'none',
              fontFamily: '"Courier New", monospace'
            }}>
              {data.temperature !== null ? `${data.temperature.toFixed(1)}°C` : '---'}
            </div>
          </div>

          {/* Umidità - Stile LED */}
          <div style={{
            padding: '1.5rem',
            background: 'rgba(50, 150, 255, 0.15)',
            border: '2px solid #3296ff',
            borderRadius: '8px',
            boxShadow: data.humidity !== null ? '0 0 20px rgba(50, 150, 255, 0.4)' : 'none'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: '#3296ff',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              HUMIDITY
            </div>
            <div style={{
              fontSize: '3rem',
              fontWeight: 'bold',
              color: data.humidity !== null ? '#3296ff' : '#666',
              textShadow: data.humidity !== null ? '0 0 15px rgba(50, 150, 255, 0.6)' : 'none',
              fontFamily: '"Courier New", monospace'
            }}>
              {data.humidity !== null ? `${data.humidity.toFixed(1)}%` : '---'}
            </div>
          </div>

          {/* Status LED */}
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            background: serverStarted ? 'rgba(0, 255, 150, 0.1)' : 'rgba(255, 50, 50, 0.1)',
            border: `2px solid ${serverStarted ? '#00ff96' : '#ff3232'}`,
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '0.8rem',
              color: serverStarted ? '#00ff96' : '#ff3232',
              marginBottom: '0.5rem',
              textTransform: 'uppercase'
            }}>
              WEBSOCKET STATUS
            </div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 'bold',
              color: serverStarted ? '#00ff96' : '#ff3232',
              textShadow: serverStarted ? '0 0 10px rgba(0, 255, 150, 0.5)' : 'none'
            }}>
              {serverStarted ? `● ONLINE (PORT ${port})` : '○ OFFLINE'}
            </div>
          </div>
        </div>

        {/* Card Controllo Server - Stile Tech */}
        <div style={{
          padding: '2rem',
          background: 'rgba(0, 0, 0, 0.6)',
          border: '2px solid #00ff96',
          borderRadius: '8px',
          boxShadow: '0 0 30px rgba(0, 255, 150, 0.2)',
          fontFamily: '"Courier New", monospace'
        }}>
          <div style={{
            color: '#00ff96',
            fontSize: '1.3rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid #00ff96',
            paddingBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            🔌 SERVER CONTROL
          </div>
          
          <button
            onClick={startServer}
            disabled={loading.start || serverStarted}
            style={{
              width: '100%',
              padding: '1.2rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: '2px solid #00ff96',
              cursor: (loading.start || serverStarted) ? 'not-allowed' : 'pointer',
              background: (loading.start || serverStarted)
                ? 'rgba(0, 255, 150, 0.2)' 
                : 'rgba(0, 255, 150, 0.3)',
              color: '#00ff96',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: '"Courier New", monospace',
              boxShadow: (loading.start || serverStarted) ? 'none' : '0 0 20px rgba(0, 255, 150, 0.4)',
              transition: 'all 0.3s',
              opacity: (loading.start || serverStarted) ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading.start && !serverStarted) {
                e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 255, 150, 0.6)'
                e.currentTarget.style.transform = 'scale(1.02)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading.start && !serverStarted) {
                e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 150, 0.4)'
                e.currentTarget.style.transform = 'scale(1)'
              }
            }}
          >
            {loading.start ? '[...] STARTING' : serverStarted ? '[✓] SERVER ACTIVE' : '[▶] START SERVER'}
          </button>

          {serverStarted && port && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(0, 255, 150, 0.1)',
              border: '1px solid #00ff96',
              borderRadius: '8px',
              fontSize: '0.9rem',
              color: '#00ff96',
              fontFamily: '"Courier New", monospace'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>PORT:</strong> {port}
              </div>
              <div>
                <strong>WS:</strong> ws://localhost:{port}
              </div>
            </div>
          )}
        </div>

        {/* Card Comandi Pin - Stile Tech */}
        <div style={{
          padding: '2rem',
          background: 'rgba(0, 0, 0, 0.6)',
          border: '2px solid #00ff96',
          borderRadius: '8px',
          boxShadow: '0 0 30px rgba(0, 255, 150, 0.2)',
          fontFamily: '"Courier New", monospace'
        }}>
          <div style={{
            color: '#00ff96',
            fontSize: '1.3rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid #00ff96',
            paddingBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            🎛️ PIN CONTROL
          </div>
          
          {/* Input Pin - Stile Terminal */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: '#00ff96',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              PIN NUMBER (0-255)
            </label>
            <input
              type="number"
              min="0"
              max="255"
              value={commandPin}
              onChange={(e) => setCommandPin(parseInt(e.target.value) || 13)}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.2rem',
                borderRadius: '8px',
                border: '2px solid #00ff96',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: '#00ff96',
                fontFamily: '"Courier New", monospace',
                textAlign: 'center',
                boxShadow: '0 0 10px rgba(0, 255, 150, 0.2)'
              }}
            />
          </div>

          {/* Toggle Stato - Stile Tech */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: '#00ff96',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              STATE
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setCommandState(true)}
                style={{
                  flex: 1,
                  padding: '1.2rem',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: `2px solid ${commandState ? '#00ff96' : '#666'}`,
                  backgroundColor: commandState ? 'rgba(0, 255, 150, 0.3)' : 'rgba(0, 0, 0, 0.5)',
                  color: commandState ? '#00ff96' : '#666',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  fontFamily: '"Courier New", monospace',
                  boxShadow: commandState ? '0 0 20px rgba(0, 255, 150, 0.4)' : 'none',
                  transition: 'all 0.3s'
                }}
              >
                [ON]
              </button>
              <button
                onClick={() => setCommandState(false)}
                style={{
                  flex: 1,
                  padding: '1.2rem',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: `2px solid ${!commandState ? '#ff3232' : '#666'}`,
                  backgroundColor: !commandState ? 'rgba(255, 50, 50, 0.3)' : 'rgba(0, 0, 0, 0.5)',
                  color: !commandState ? '#ff3232' : '#666',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  fontFamily: '"Courier New", monospace',
                  boxShadow: !commandState ? '0 0 20px rgba(255, 50, 50, 0.4)' : 'none',
                  transition: 'all 0.3s'
                }}
              >
                [OFF]
              </button>
            </div>
          </div>

          {/* Pulsante Invia - Stile Tech */}
          <button
            onClick={sendCommand}
            disabled={loading.command || !serverStarted}
            style={{
              width: '100%',
              padding: '1.2rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: '2px solid #00ff96',
              cursor: (loading.command || !serverStarted) ? 'not-allowed' : 'pointer',
              background: (loading.command || !serverStarted)
                ? 'rgba(0, 255, 150, 0.2)' 
                : 'rgba(0, 255, 150, 0.3)',
              color: '#00ff96',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: '"Courier New", monospace',
              boxShadow: (loading.command || !serverStarted) ? 'none' : '0 0 20px rgba(0, 255, 150, 0.4)',
              transition: 'all 0.3s',
              opacity: (loading.command || !serverStarted) ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading.command && serverStarted) {
                e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 255, 150, 0.6)'
                e.currentTarget.style.transform = 'scale(1.02)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading.command && serverStarted) {
                e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 150, 0.4)'
                e.currentTarget.style.transform = 'scale(1)'
              }
            }}
          >
            {loading.command ? '[...] SENDING' : `[→] SEND PIN ${commandPin} ${commandState ? 'ON' : 'OFF'}`}
          </button>
        </div>
      </div>
    </div>
  )
}