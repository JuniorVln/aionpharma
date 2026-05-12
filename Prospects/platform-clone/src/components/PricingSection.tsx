import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const plans = [
  {
    name: "Studio",
    price: "$49",
    period: "/month",
    description: "Perfect for growing teams building their first automated infrastructure.",
    features: [
      "Up to 5 team members",
      "Basic automation workflows",
      "Standard support (24h SLA)",
      "99.9% uptime guarantee",
      "Community plugins access"
    ],
    popular: false,
    buttonText: "Start Free Trial"
  },
  {
    name: "Scale",
    price: "$89",
    period: "/month",
    description: "For expanding businesses needing AI-driven auto-scaling capabilities.",
    features: [
      "Unlimited team members",
      "Advanced AI auto-scaling",
      "Priority support (1h SLA)",
      "99.99% uptime guarantee",
      "Custom plugins & webhooks",
      "Advanced analytics dashboard"
    ],
    popular: true,
    buttonText: "Get Started"
  },
  {
    name: "Supreme",
    price: "$249",
    period: "/month",
    description: "Enterprise-grade dedicated infrastructure with proactive security.",
    features: [
      "Everything in Scale",
      "Dedicated infrastructure",
      "24/7 Phone support",
      "99.999% uptime guarantee",
      "Custom security policies",
      "Dedicated account manager",
      "On-premise deployment options"
    ],
    popular: false,
    buttonText: "Contact Sales"
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

export function PricingSection() {
  return (
    <section id="pricing" className="py-32 px-8 relative z-10 bg-black">
      <div className="max-w-[1400px] mx-auto relative">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="flex items-center justify-center gap-4 mb-6"
          >
            <div className="w-8 h-[1px] bg-accent"></div>
            <span className="text-accent text-sm font-semibold tracking-wider uppercase">Pricing</span>
            <div className="w-8 h-[1px] bg-accent"></div>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tighter text-white mb-6"
          >
            Simple pricing for <br className="hidden md:block" /> complex systems.
          </motion.h2>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {plans.map((plan, index) => (
            <motion.div 
              key={index}
              variants={itemVariants}
              className={`relative rounded-3xl p-8 lg:p-10 ${
                plan.popular 
                  ? 'bg-[#111] border border-accent/30 shadow-[0_0_50px_rgba(255,90,54,0.1)]' 
                  : 'glass-dark hover:bg-[#151515] transition-colors duration-300'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-black text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              
              <h3 className="text-2xl font-semibold text-white mb-2">{plan.name}</h3>
              <p className="text-secondary text-sm mb-8 min-h-[40px]">{plan.description}</p>
              
              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-5xl font-medium tracking-tighter text-white">{plan.price}</span>
                <span className="text-secondary">{plan.period}</span>
              </div>
              
              <button 
                className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 mb-10 ${
                  plan.popular
                    ? 'bg-accent hover:bg-[#ff7354] text-black'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {plan.buttonText}
              </button>
              
              <div className="space-y-4">
                <p className="text-sm font-medium text-white mb-6 uppercase tracking-wider">What's included</p>
                {plan.features.map((feature, fIndex) => (
                  <div key={fIndex} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full p-1 bg-accent/10 flex-shrink-0">
                      <Check className="w-3 h-3 text-accent" strokeWidth={3} />
                    </div>
                    <span className="text-secondary text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
