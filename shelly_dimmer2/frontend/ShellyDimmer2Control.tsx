import { useState } from 'react'

interface ShellyDimmer2ControlProps {
  sensorName: string
}

export default function ShellyDimmer2Control({ sensorName }: ShellyDimmer2ControlProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [brightness, setBrightness] = useState(50)
  const [dimStep, setDimStep] = useState(10)

  const setLoadingState = (action: string, value: boolean) => {
    setLoading(prev => ({ ...prev, [action]: value }))
  }

  const callAPI = async (endpoint: string, body: any, actionName: string) => {
    setLoadingState(actionName, true)
    try {
      const response = await fetch(`http://localhost:8000/sensors/shelly-dimmer2${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensor_name: sensorName, ...body })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Errore nella richiesta')
      }
      
      const result = await response.json()
      console.log('Risultato:', result)
    } catch (error) {
      console.error('Errore:', error)
      alert(error instanceof Error ? error.message : 'Errore sconosciuto')
    } finally {
      setLoadingState(actionName, false)
    }
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      padding: '2rem',
      backgroundColor: '#360185',
      color: '#FFFFFF'
    }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '2rem', 
        borderBottom: '2px solid #F4B342', 
        paddingBottom: '1rem' 
      }}>
        <h1 style={{ color: '#F4B342', fontSize: '2rem', margin: 0 }}>
          Shelly Dimmer 2: {sensorName}
        </h1>
      </div>

      {/* Layout a griglia per fullscreen */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '2rem'
      }}>
        {/* Sezione Controllo Base */}
        <div style={{ 
          padding: '2rem',
          borderRadius: '12px',
          border: '2px solid #8F0177',
          background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
        }}>
          <h2 style={{ 
            color: '#F4B342', 
            marginTop: 0, 
            marginBottom: '1.5rem', 
            fontSize: '1.5rem' 
          }}>
            Controllo Luce
          </h2>
          
          {/* Pulsanti controllo - più grandi */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '1rem' 
          }}>
            <button
              onClick={() => callAPI('/light/turn-on', { brightness }, 'light_on')}
              disabled={loading.light_on}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.light_on ? 'not-allowed' : 'pointer',
                background: loading.light_on 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #4CAF50, #45a049)',
                color: '#FFFFFF',
                opacity: loading.light_on ? 0.7 : 1
              }}
            >
              {loading.light_on ? '...' : 'Accendi'}
            </button>
            <button
              onClick={() => callAPI('/light/turn-off', {}, 'light_off')}
              disabled={loading.light_off}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.light_off ? 'not-allowed' : 'pointer',
                background: loading.light_off 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #DE1A58, #8F0177)',
                color: '#FFFFFF',
                opacity: loading.light_off ? 0.7 : 1
              }}
            >
              {loading.light_off ? '...' : 'Spegni'}
            </button>
            <button
              onClick={() => callAPI('/light/toggle', {}, 'light_toggle')}
              disabled={loading.light_toggle}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.light_toggle ? 'not-allowed' : 'pointer',
                background: loading.light_toggle 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #F4B342, #e6a63d)',
                color: '#FFFFFF',
                opacity: loading.light_toggle ? 0.7 : 1
              }}
            >
              {loading.light_toggle ? '...' : 'Toggle'}
            </button>
          </div>
        </div>

        {/* Sezione Luminosità */}
        <div style={{ 
          padding: '2rem',
          borderRadius: '12px',
          border: '2px solid #8F0177',
          background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
        }}>
          <h2 style={{ 
            color: '#F4B342', 
            marginTop: 0, 
            marginBottom: '1.5rem', 
            fontSize: '1.5rem' 
          }}>
            Luminosità
          </h2>
          
          {/* Slider luminosità - più grande */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '1rem', 
              color: '#FFFFFF', 
              fontSize: '1rem',
              fontWeight: 'bold'
            }}>
              Luminosità (1-100%)
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value))}
              style={{ 
                width: '100%', 
                height: '12px',
                cursor: 'pointer'
              }}
            />
            <div style={{ 
              textAlign: 'center', 
              marginTop: '1rem', 
              color: '#F4B342', 
              fontSize: '2rem',
              fontWeight: 'bold'
            }}>
              {brightness}%
            </div>
          </div>

          {/* Pulsanti luminosità */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <button
              onClick={() => callAPI('/light/set-brightness', { brightness }, 'set_brightness')}
              disabled={loading.set_brightness}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.set_brightness ? 'not-allowed' : 'pointer',
                background: loading.set_brightness 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #F4B342, #e6a63d)',
                color: '#FFFFFF',
                opacity: loading.set_brightness ? 0.7 : 1
              }}
            >
              {loading.set_brightness ? '...' : `Imposta ${brightness}%`}
            </button>
            <button
              onClick={() => callAPI('/light/turn-on', { brightness }, 'turn_on_brightness')}
              disabled={loading.turn_on_brightness}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.turn_on_brightness ? 'not-allowed' : 'pointer',
                background: loading.turn_on_brightness 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #4CAF50, #45a049)',
                color: '#FFFFFF',
                opacity: loading.turn_on_brightness ? 0.7 : 1
              }}
            >
              {loading.turn_on_brightness ? '...' : `Accendi ${brightness}%`}
            </button>
          </div>

          {/* Preset luminosità - più grandi */}
          <div>
            <div style={{ 
              marginBottom: '1rem', 
              color: '#FFFFFF', 
              fontSize: '1rem',
              fontWeight: 'bold'
            }}>
              Preset Luminosità:
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '1rem' 
            }}>
              <button
                onClick={() => setBrightness(25)}
                style={{
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: '2px solid #8F0177',
                  backgroundColor: 'rgba(244, 179, 66, 0.3)',
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                25%
              </button>
              <button
                onClick={() => setBrightness(50)}
                style={{
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: '2px solid #8F0177',
                  backgroundColor: 'rgba(244, 179, 66, 0.3)',
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                50%
              </button>
              <button
                onClick={() => setBrightness(75)}
                style={{
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: '2px solid #8F0177',
                  backgroundColor: 'rgba(244, 179, 66, 0.3)',
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                75%
              </button>
              <button
                onClick={() => setBrightness(100)}
                style={{
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: '2px solid #8F0177',
                  backgroundColor: 'rgba(244, 179, 66, 0.3)',
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                100%
              </button>
            </div>
          </div>
        </div>

        {/* Sezione Dimming Progressivo */}
        <div style={{ 
          padding: '2rem',
          borderRadius: '12px',
          border: '2px solid #8F0177',
          background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
        }}>
          <h2 style={{ 
            color: '#F4B342', 
            marginTop: 0, 
            marginBottom: '1.5rem', 
            fontSize: '1.5rem' 
          }}>
            Dimming Progressivo
          </h2>
          
          {/* Slider step */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '1rem', 
              color: '#FFFFFF', 
              fontSize: '1rem',
              fontWeight: 'bold'
            }}>
              Step (1-100%)
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={dimStep}
              onChange={(e) => setDimStep(parseInt(e.target.value))}
              style={{ 
                width: '100%', 
                height: '12px',
                cursor: 'pointer'
              }}
            />
            <div style={{ 
              textAlign: 'center', 
              marginTop: '1rem', 
              color: '#F4B342', 
              fontSize: '1.5rem',
              fontWeight: 'bold'
            }}>
              {dimStep}%
            </div>
          </div>

          {/* Pulsanti dimming */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '1rem' 
          }}>
            <button
              onClick={() => callAPI('/light/dim', { direction: 'up', step: dimStep }, 'dim_up')}
              disabled={loading.dim_up}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.dim_up ? 'not-allowed' : 'pointer',
                background: loading.dim_up 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #4CAF50, #45a049)',
                color: '#FFFFFF',
                opacity: loading.dim_up ? 0.7 : 1
              }}
            >
              {loading.dim_up ? '...' : '↑ Up'}
            </button>
            <button
              onClick={() => callAPI('/light/dim', { direction: 'down', step: dimStep }, 'dim_down')}
              disabled={loading.dim_down}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.dim_down ? 'not-allowed' : 'pointer',
                background: loading.dim_down 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #DE1A58, #8F0177)',
                color: '#FFFFFF',
                opacity: loading.dim_down ? 0.7 : 1
              }}
            >
              {loading.dim_down ? '...' : '↓ Down'}
            </button>
            <button
              onClick={() => callAPI('/light/dim', { direction: 'stop' }, 'dim_stop')}
              disabled={loading.dim_stop}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.dim_stop ? 'not-allowed' : 'pointer',
                background: loading.dim_stop 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #F4B342, #e6a63d)',
                color: '#FFFFFF',
                opacity: loading.dim_stop ? 0.7 : 1
              }}
            >
              {loading.dim_stop ? '...' : 'Stop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}