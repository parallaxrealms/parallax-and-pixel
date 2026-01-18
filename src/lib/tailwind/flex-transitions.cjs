const plugin = require('tailwindcss/plugin');

module.exports = plugin(function ({ addUtilities }) {
  const combined = {};
  const aligns = ['start', 'center', 'end', 'stretch', 'baseline'];
  const just = ['start', 'center', 'end', 'between', 'around', 'evenly', 'normal', 'stretch'];

  aligns.forEach((a) => {
    just.forEach((j) => {
      const cls = `.${a}-${j}`;
      combined[cls] = {
        'align-items': a === 'start' ? 'flex-start' : a === 'end' ? 'flex-end' : a,
        'justify-content':
          j === 'start' ? 'flex-start'
            : j === 'end' ? 'flex-end'
              : ['between', 'around', 'evenly'].includes(j) ? `space-${j}` : j
      };
    });
  });

  addUtilities(
    {
      // keep these simple; use Tailwind responsive variants in markup
      '.flex-fluid': { display: 'flex', flexDirection: 'column' },
      '.h-fluid': { height: 'auto' },

      // generated alignment utilities
      ...combined
    },
    ['responsive'] // enables md:, lg:, etc. variants
  );
});
