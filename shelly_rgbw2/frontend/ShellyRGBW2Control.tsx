import { useState } from 'react'

interface ShellyRGBW2ControlProps {
  sensorName: string
}

export default function ShellyRGBW2Control({ sensorName }: ShellyRGBW2ControlProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [colorValues, setColorValues] = useState({ red: 255, green: 255, blue: 255, white: 0 })
  const [brightness, setBrightness] = useState(50)

  const setLoadingState = (action: string, value: boolean) => {
    setLoading(prev => ({ ...prev, [action]: value }))
  }

  const callAPI = async (endpoint: string, body: any, actionName: string) => {
    setLoadingState(actionName, true)
    try {
      const response = await fetch(`http://localhost:8000/sensors/shelly-rgbw2${endpoint}`, {
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

  // MODIFICATO: Container fullscreen
  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',  // ← Occupa tutto lo schermo
      padding: '2rem',
      backgroundColor: '#360185',  // ← Sfondo coerente
      color: '#FFFFFF'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', borderBottom: '2px solid #F4B342', paddingBottom: '1rem' }}>
        <h1 style={{ color: '#F4B342', fontSize: '2rem', margin: 0 }}>
          Shelly RGBW2: {sensorName}
        </h1>
      </div>

      {/* Contenuto principale - layout a griglia per fullscreen */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '2rem'
      }}>
        {/* Sezione COLOR */}
        <div style={{ 
          padding: '2rem',
          borderRadius: '12px',
          border: '2px solid #8F0177',
          background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
        }}>
          <h2 style={{ color: '#F4B342', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem' }}>
            Controllo Colore (RGBW)
          </h2>
          
          {/* Controlli RGBW - più grandi per fullscreen */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#FFFFFF', fontSize: '1rem' }}>
                Rosso (0-255)
              </label>
              <input
                type="range"
                min="0"
                max="255"
                value={colorValues.red}
                onChange={(e) => setColorValues(prev => ({ ...prev, red: parseInt(e.target.value) }))}
                style={{ width: '100%', height: '8px' }}
              />
              <div style={{ textAlign: 'center', marginTop: '0.5rem', color: '#F4B342', fontSize: '1.2rem', fontWeight: 'bold' }}>
                {colorValues.red}
              </div>
            </div>
            
            {/* Ripeti per Verde, Blu, Bianco... */}
            {/* ... resto del codice ... */}
          </div>

          {/* Anteprima colore - più grande */}
          <div style={{ 
            marginBottom: '2rem',
            padding: '3rem',
            borderRadius: '12px',
            border: '2px solid #8F0177',
            backgroundColor: `rgb(${colorValues.red}, ${colorValues.green}, ${colorValues.blue})`,
            minHeight: '150px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ color: '#FFFFFF', fontSize: '1.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              Anteprima Colore
            </div>
          </div>

          {/* Pulsanti - più grandi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <button
              onClick={() => callAPI('/color/turn-on', colorValues, 'color_on')}
              disabled={loading.color_on}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.color_on ? 'not-allowed' : 'pointer',
                background: loading.color_on 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #4CAF50, #45a049)',
                color: '#FFFFFF'
              }}
            >
              {loading.color_on ? '...' : 'Accendi'}
            </button>
            {/* Altri pulsanti... */}
          </div>
        </div>

        {/* Sezione WHITE - layout simile */}
        {/* ... */}
      </div>
    </div>
  )
}