import React from 'react';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';

export function Navbar() {
  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="absolute top-0 left-0 right-0 z-50 px-8 py-6"
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        <div className="flex items-center">
          {/* Logo */}
          <span className="font-semibold text-2xl tracking-tighter text-accent flex items-center">
            plat<span className="mx-0.5">—</span>form<span className="text-xs align-super ml-0.5">™</span>
          </span>
        </div>
        
        <div>
          <button className="text-accent hover:text-white transition-colors">
            <Menu className="w-8 h-8" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </motion.nav>
  );
}
