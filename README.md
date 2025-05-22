# SplitSUI Frontend

A React-based frontend for the SplitSUI dApp, allowing users to perform multi-send transactions and create group payments on the Sui blockchain.

## Features

- Multi-send SUI tokens to multiple addresses in one transaction
- Create group payment requests where multiple people can contribute
- Modern UI with Tailwind CSS
- Sui Wallet integration
- Testnet and Mainnet support

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Sui Wallet browser extension
- Git

## Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/clatsonhacks/sui-overflow.git
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the frontend directory:
```bash
VITE_PACKAGE_ID=0x1166b49490f8f7916a670afd8c8134f008005551f16c761250689afc2a487f8d
VITE_NETWORK=testnet
```

4. Start the development server:
```bash
npm run dev
```

The app will be available at http://localhost:5173

## Building for Production

```bash
npm run build
```

This will create a `dist` directory with the production-ready files.

## Deployment Options

### 1. Vercel (Recommended)

#### Option A: Deploy via Vercel CLI
1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

#### Option B: Deploy via GitHub
1. Push your code to GitHub:
```bash
git add .
git commit -m "Initial frontend commit"
git push origin main
```

2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure build settings:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
6. Add environment variables:
   - `VITE_PACKAGE_ID`
   - `VITE_NETWORK`
7. Click "Deploy"

### 2. Netlify

#### Option A: Deploy via Netlify CLI
1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Login to Netlify:
```bash
netlify login
```

3. Deploy:
```bash
netlify deploy --prod
```

#### Option B: Deploy via GitHub
1. Push your code to GitHub (same as above)
2. Go to [netlify.com](https://netlify.com)
3. Click "New site from Git"
4. Connect GitHub and select repository
5. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Add environment variables in Site settings
7. Click "Deploy site"

### 3. GitHub Pages

1. Add `homepage` field to `package.json`:
```json
{
  "homepage": "https://clatsonhacks.github.io/sui-overflow"
}
```

2. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

3. Add deploy scripts to `package.json`:
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

4. Deploy:
```bash
npm run deploy
```

## Environment Variables

Required environment variables:
- `VITE_PACKAGE_ID`: Your deployed contract package ID
- `VITE_NETWORK`: Network to use (testnet/mainnet)

## Custom Domain Setup

### Vercel
1. Go to project settings
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### Netlify
1. Go to Site settings > Domain management
2. Add custom domain
3. Follow DNS configuration instructions

## Troubleshooting

### Common Issues

1. **Wallet Connection Issues**
   - Ensure Sui Wallet extension is installed
   - Check if you're on the correct network
   - Clear browser cache and reload

2. **Build Failures**
   - Check Node.js version (v16+ required)
   - Clear node_modules and reinstall:
     ```bash
     rm -rf node_modules package-lock.json
     npm install
     ```

3. **Styling Issues**
   - Ensure Tailwind CSS is properly configured
   - Check if PostCSS is installed
   - Verify content paths in tailwind.config.js

4. **Transaction Failures**
   - Verify contract package ID
   - Check network configuration
   - Ensure sufficient SUI balance

### Debug Commands

```bash
# Check Node version
node --version

# Check npm version
npm --version

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check build
npm run build

# Run tests (if configured)
npm test
```

## Project Structure

```
frontend/
├── public/
│   ├── index.html
│   └── vite.svg
├── src/
│   ├── App.jsx
│   ├── SplitSUIApp.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT 
