# 🎨 Enhanced Dialog/Popup System Documentation

## Overview
A comprehensive, beautifully designed popup/dialog system with multiple visual styles, animations, and use cases for the Coin Cubby Kiosk application.

## Features
✅ **7 Different Popup Types** with unique colors and icons
✅ **Beautiful Animations** - bounce in, pulse, shake, spin, swing
✅ **Backdrop Blur** for modern aesthetics
✅ **Custom Button Text** support
✅ **Callback Functions** for confirmation actions
✅ **Gradient Backgrounds** matching popup type
✅ **Consistent Design Language** across all dialogs

---

## API Usage

### Function Signature
```javascript
App.showDialog(message, title, type, buttonText, onConfirm)
```

**Parameters:**
- `message` (string) - The main message content (supports HTML)
- `title` (string, default: 'Alert') - The dialog title
- `type` (string, default: 'warning') - Visual style type
- `buttonText` (string, default: 'OK') - Custom button text
- `onConfirm` (function, optional) - Callback when OK is clicked

---

## Available Popup Types

### 1. **Success** 💚
**Use Case:** Confirmations, successful operations, completed actions
**Color:** Green
**Icon:** check_circle with bounce animation

```javascript
App.showDialog(
    'Your rental has been confirmed successfully!',
    'Rental Confirmed',
    'success',
    'GREAT!'
);
```

### 2. **Error** ❌
**Use Case:** Critical failures, denied access, invalid operations
**Color:** Red
**Icon:** error with shake animation

```javascript
App.showDialog(
    'This compartment is currently occupied. Please choose another.',
    'Compartment Unavailable',
    'error',
    'TRY AGAIN'
);
```

### 3. **Warning** ⚠️
**Use Case:** Important notices, cautionary messages, attention needed
**Color:** Orange/Yellow
**Icon:** warning with swing animation

```javascript
App.showDialog(
    'Not enough coins to give change. Any excess will be added to your wallet.',
    'Insufficient Coins for Change',
    'warning',
    'UNDERSTOOD'
);
```

### 4. **Info** ℹ️
**Use Case:** Informational messages, helpful tips, general notices
**Color:** Blue
**Icon:** info with pulse animation

```javascript
App.showDialog(
    'Your digital receipt is available in the web app.',
    'Receipt Information',
    'info',
    'GOT IT'
);
```

### 5. **Question** ❓
**Use Case:** Confirmation prompts, user decisions, choice dialogs
**Color:** Purple
**Icon:** help_outline with pulse animation

```javascript
App.showDialog(
    'Are you sure you want to cancel this rental?',
    'Confirm Cancellation',
    'question',
    'YES, CANCEL'
);
```

### 6. **Coins** 🪙
**Use Case:** Change-related messages, coin inventory alerts, dispenser issues
**Color:** Orange (coin gold)
**Icon:** savings with spin animation

```javascript
App.showDialog(
    'Change amount is less than ₱20. Please choose "Add to Wallet" instead.',
    'Minimum Amount Required',
    'coins',
    'GOT IT'
);
```

### 7. **Payment** 💳
**Use Case:** Payment confirmations, wallet operations, transaction complete
**Color:** Green (payment success)
**Icon:** payments with pulse animation

```javascript
App.showDialog(
    'Payment of ₱50.00 has been successfully processed.',
    'Payment Complete',
    'payment',
    'CONTINUE'
);
```

---

## Advanced Usage

### With Callback Function
```javascript
App.showDialog(
    'Do you want to proceed with this action?',
    'Confirm Action',
    'question',
    'YES, PROCEED',
    () => {
        console.log('User confirmed!');
        // Execute action here
    }
);
```

### With HTML Formatting
```javascript
App.showDialog(
    'Current inventory: <strong>₱25.00</strong><br>Minimum required: <strong>₱50.00</strong>',
    'Low Inventory Warning',
    'warning',
    'REFILL NOW'
);
```

---

## Visual Specifications

### Dialog Dimensions
- **Max Width:** 620px
- **Padding:** 48px
- **Border Radius:** 24px
- **Border:** 3px solid (color matches type)

### Icon Size & Animation
- **Icon Size:** 80px
- **Animations:** Customized per type (bounce, shake, swing, spin, pulse)
- **Animation Duration:** 0.5s - 2s depending on type

### Typography
- **Title:** 28px, Weight 800
- **Message:** 18px, Weight 500
- **Button:** 17px, Weight 700

### Backdrop
- **Background:** rgba(0, 0, 0, 0.65)
- **Blur:** 6px
- **Transition:** 0.3s ease

---

## Testing Commands

To test all popup styles, open the browser console on localhost and run:

```javascript
// Test Success
App.showDialog('Operation completed successfully!', 'Success', 'success', 'AWESOME!');

// Test Error
App.showDialog('Access denied. Please try again.', 'Error', 'error', 'OK');

// Test Warning
App.showDialog('This action cannot be undone.', 'Warning', 'warning', 'UNDERSTOOD');

// Test Info
App.showDialog('Your session will expire in 5 minutes.', 'Information', 'info', 'GOT IT');

// Test Question
App.showDialog('Would you like to save your progress?', 'Confirm', 'question', 'YES');

// Test Coins
App.showDialog('Coin inventory is running low.', 'Inventory Alert', 'coins', 'REFILL');

// Test Payment
App.showDialog('Payment received: ₱100.00', 'Payment Success', 'payment', 'DONE');
```

---

## Implementation Files

### Files Modified:
1. **app.js** - Enhanced `showDialog()` function
2. **styles.css** - Added 7 popup type styles with animations
3. **index.html** - Updated dialog structure with icon in button

### Key CSS Classes:
- `.global-dialog-overlay` - Main overlay container
- `.global-dialog-box` - Dialog container
- `.global-dialog-icon` - Animated icon
- `.success-bg`, `.error-bg`, `.warning-bg`, etc. - Type-specific backgrounds

---

## Current Implementation Status

### ✅ Updated Screens:
- Payment Method (insufficient change warning)
- Cash Payment (coin minimum, insufficient inventory)
- Admin Login (validation, errors)
- Admin Verify OTP (validation, errors)
- Admin Inventory (refill success, cashout success, errors)
- Select Compartment (occupied, maintenance)
- Locker Warning (reminder popup)

### 🎯 Benefits:
- **Consistent UX** across all alerts
- **Better Visual Feedback** with type-specific colors
- **Professional Appearance** with animations and blur
- **Improved Readability** with larger, clearer text
- **Custom Actions** with callback support

---

## Migration Guide

### Old API:
```javascript
App.showDialog(message, title, icon);
```

### New API:
```javascript
App.showDialog(message, title, type, buttonText, onConfirm);
```

### Quick Migration:
- Replace icon parameter names with type names
- `'error'` → stays `'error'`
- `'warning'` → stays `'warning'`
- `'check_circle'` → use `'success'`
- Add custom button text for better UX
- Add callbacks where confirmation is needed

---

## Browser Compatibility
✅ Chrome/Edge (tested)
✅ Firefox
✅ Safari
✅ Modern browsers with CSS backdrop-filter support

---

Made with ❤️ for Coin Cubby Kiosk
