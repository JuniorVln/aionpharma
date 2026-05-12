import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Network, Shield, Zap } from 'lucide-react';

const services = [
  {
    icon: <Cpu className="w-8 h-8 text-accent" strokeWidth={1.5} />,
    title: "Design Engine",
    description: "Automated infrastructure architect. Generates optimized topologies based on your specific workload requirements."
  },
  {
    icon: <Network className="w-8 h-8 text-accent" strokeWidth={1.5} />,
    title: "Scale Matrix",
    description: "Intelligent scaling system that predicts traffic spikes and provisions resources preemptively."
  },
  {
    icon: <Zap className="w-8 h-8 text-accent" strokeWidth={1.5} />,
    title: "Neural Net",
    description: "Machine learning core reducing latency to milliseconds across global edge networks."
  },
  {
    icon: <Shield className="w-8 h-8 text-accent" strokeWidth={1.5} />,
    title: "Shield Core",
    description: "Proactive security framework that evolves and adapts against emerging zero-day threats."
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

export function ServicesSection() {
  return (
    <section id="services" className="py-32 px-8 relative z-10 overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-[1400px] mx-auto relative">
        <div className="mb-20 md:mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="flex items-center gap-4 mb-6"
          >
            <div className="w-12 h-[1px] bg-accent"></div>
            <span className="text-accent text-sm font-semibold tracking-wider uppercase">Core Services</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tighter text-white max-w-3xl leading-[1.1]"
          >
            Transforming how infrastructure thinks and evolves.
          </motion.h2>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
        >
          {services.map((service, index) => (
            <motion.div 
              key={index}
              variants={itemVariants}
              className="group glass-dark p-10 md:p-12 hover:bg-[#1a1a1a] transition-all duration-500 cursor-pointer relative overflow-hidden"
            >
              {/* Hover gradient effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10">
                <div className="mb-8 w-16 h-16 rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 group-hover:border-accent/30">
                  {service.icon}
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4 tracking-tight">{service.title}</h3>
                <p className="text-secondary text-lg leading-relaxed max-w-md">
                  {service.description}
                </p>
              </div>
              
              {/* Bottom line decorator */}
              <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-accent group-hover:w-full transition-all duration-700 ease-out"></div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
