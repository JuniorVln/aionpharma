import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight, Play } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 pb-12 px-8 overflow-hidden">
      {/* Background with nebulas and stars */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 stars-pattern"></div>
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#2563eb]/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[#2563eb]/10 rounded-full blur-[150px]"></div>
      </div>

      <div className="max-w-[1400px] w-full mx-auto relative z-10 flex flex-col justify-center mt-12">
        
        <div className="w-full flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-12 xl:gap-16 relative">
          
          {/* LEFT COLUMN - Hidden on mobile, visible on desktop */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="hidden lg:block w-56 xl:w-64 shrink-0 pt-6"
          >
            <div className="border-l border-white/20 pl-4 py-1">
              <p className="text-white text-lg tracking-tight font-medium">✨ Inteligência</p>
              <p className="text-white text-lg tracking-tight font-bold">Artificial em Vendas.</p>
            </div>
          </motion.div>

          {/* LEFT COLUMN - Visible on mobile only, placed before title */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="block lg:hidden mb-4"
          >
            <div className="border-l border-white/20 pl-4 py-1">
              <p className="text-white text-lg tracking-tight font-medium">✨ Inteligência</p>
              <p className="text-white text-lg tracking-tight font-bold">Artificial em Vendas.</p>
            </div>
          </motion.div>

          {/* CENTER COLUMN (Main Title) */}
          <div className="flex-1 relative z-10">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="text-[4rem] sm:text-[5rem] md:text-[6rem] lg:text-[7rem] leading-[0.95] font-medium tracking-tighter text-white"
            >
              <span className="inline-block w-16 md:w-24 h-1 bg-white align-middle mr-4 md:mr-6 mb-4 md:mb-8"></span>
              O futuro das <br />
              vendas <br />
              <span className="text-accent">chegou.</span>
            </motion.h1>
          </div>

          {/* RIGHT COLUMN (Description & Buttons) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col gap-8 w-full lg:w-[350px] xl:w-[450px] shrink-0 pt-6"
          >
            <div>
              <h2 className="text-2xl font-semibold text-white tracking-tight mb-4">Esqueça os CRMs do passado.</h2>
              <p className="text-secondary text-base leading-relaxed">
                O <strong className="text-white">Vendas Mais</strong> é o seu novo ecossistema inteligente que antecipa objeções, qualifica leads e fecha negócios enquanto você foca no que importa: <span className="text-accent font-medium">escalar.</span>
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <button className="bg-accent hover:bg-blue-600 transition-colors text-white font-semibold px-8 py-4 rounded-xl flex items-center justify-center gap-3 text-lg whitespace-nowrap shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                <Calendar className="w-5 h-5" />
                AGENDAR DEMO VIP
              </button>
              <button className="flex items-center justify-center gap-3 text-white font-bold hover:text-accent transition-colors px-8 py-4 rounded-xl text-sm border border-white/10 hover:bg-white/5 whitespace-nowrap">
                <Play className="w-5 h-5" fill="none" />
                ASSISTIR AO MANIFESTO
              </button>
            </div>
          </motion.div>

        </div>

        {/* Bottom Stats Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-24 lg:ml-[16rem] xl:ml-[18rem] flex flex-col sm:flex-row gap-12 sm:gap-24"
        >
          {/* Stat 1 */}
          <div className="flex items-center gap-4">
            <span className="text-4xl font-light text-accent tracking-tighter">97,8<span className="text-xl">%</span></span>
            <div className="border-l border-white/20 pl-4">
              <p className="text-white font-medium text-sm tracking-tight mb-0.5">Engajamento</p>
              <p className="text-secondary text-xs">Média de abertura</p>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="flex items-center gap-4">
            <span className="text-4xl font-light text-accent tracking-tighter">+31,2<span className="text-xl">%</span></span>
            <div className="border-l border-white/20 pl-4">
              <p className="text-white font-medium text-sm tracking-tight mb-0.5">Conversão</p>
              <p className="text-secondary text-xs">Funil otimizado por IA</p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
