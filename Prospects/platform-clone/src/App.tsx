import React from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ServicesSection } from './components/ServicesSection';
import { PricingSection } from './components/PricingSection';

function App() {
  return (
    <div className="min-h-screen bg-background text-primary selection:bg-accent/30 selection:text-white">
      <Navbar />
      <main>
        <HeroSection />
        <ServicesSection />
        <PricingSection />
      </main>
    </div>
  );
}

export default App;
