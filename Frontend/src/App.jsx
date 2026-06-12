import React, { useState } from 'react';
import GloobalAccess from './GloobalAccess';
import GloobalAuth from './GloobalAuth';
import Dashboard from './Dashboard';

export default function App() {
  // Explicitly track which page should be visible: 'register', 'login', or 'dashboard'
  const [currentPage, setCurrentPage] = useState('register');
  const [session, setSession] = useState({ symbolId: '', fullName: '' });

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      
      {/* 1. REGISTRATION STEP */}
      {currentPage === 'register' && (
        <GloobalAccess 
          onComplete={(userData) => {
            setSession({ symbolId: userData.symbolId, fullName: userData.fullName });
            setCurrentPage('login'); // Instantly switch to login pad
          }} 
        />
      )}

      {/* 2. SECURE LOGIN STEP */}
      {currentPage === 'login' && (
        <GloobalAuth 
          symbolId={session.symbolId} 
          onSuccess={() => {
            setCurrentPage('dashboard'); // Instantly switch to scrollable dashboard!
          }} 
        />
      )}

      {/* 3. LIVE DASHBOARD STEP */}
      {currentPage === 'dashboard' && (
        <Dashboard symbolId={session.symbolId} />
      )}

    </div>
  );
}

