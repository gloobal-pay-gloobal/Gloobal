import React, { useState } from 'react';
import GloobalAuth from './GloobalAuth';
import GloobalRegistration from './GloobalRegistration';

function App() {
  // State to track if the user has passed the security check
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* The Traffic Cop Logic: 
        If isAuthenticated is false, show Auth screen. 
        If true, show the Registration dashboard! 
      */}
      {!isAuthenticated ? (
        <GloobalAuth onAuthenticated={() => setIsAuthenticated(true)} />
      ) : (
        <GloobalRegistration />
      )}
      
    </div>
  );
}

export default App;