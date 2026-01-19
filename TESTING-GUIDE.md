
# Highway Cafe POS System - Comprehensive Testing Guide

## Overview
This guide provides step-by-step testing procedures for all features of the Highway Cafe POS system, including the newly enhanced inventory management, order management, and cost analysis features.

## Pre-Testing Setup

### Default Login Credentials
- **Admin**: `admin` / `admin123`
- **Manager**: `manager` / `manager123` 
- **Cashier**: `cashier` / `cashier123`
- **Barista**: `barista` / `barista123`
- **Courier**: `courier` / `courier123`

### System Configuration
- **Exchange Rate**: 1 USD = 89,500 LBP (LBP rounded to nearest 5000)
- **Tax**: Tax-inclusive pricing (no separate tax calculations)
- **Database**: PostgreSQL with real-time inventory tracking

## 🧪 Core Feature Testing

### 1. Authentication & Role-Based Access

#### Test 1.1: Login System
1. Navigate to the application
2. Test each role login (admin, manager, cashier, barista, courier)
3. Verify dashboard loads correctly for each role
4. **Expected**: Each role sees appropriate interface and permissions

#### Test 1.2: Role Permissions
1. Login as **cashier** → Verify access to: POS interface, customer orders
2. Login as **barista** → Verify access to: Order queue, status updates
3. Login as **courier** → Verify access to: Delivery management, status updates
4. Login as **manager** → Verify access to: All features except user management
5. Login as **admin** → Verify access to: All features including user management

### 2. Point of Sale System

#### Test 2.1: Basic Order Creation
1. Login as **cashier**
2. Navigate to POS interface
3. Add products to cart: `Espresso ($3.50)`, `Croissant ($2.25)`
4. Enter customer details: "John Doe", "555-0123"
5. Process payment
6. **Expected**: Order created with correct totals, dual currency display

#### Test 2.2: Barcode Scanning
1. In POS interface, click barcode scan button
2. Test with product barcode (if available) or use search function
3. Verify product adds to cart correctly
4. **Expected**: Quick product addition without manual search

#### Test 2.3: Dual Currency Support
1. Add product to cart: `Turkey Sandwich ($8.50)`
2. Verify USD display: `$8.50`
3. Verify LBP display: `760,750 LBP` (rounded to nearest 5000)
4. **Expected**: Accurate currency conversion with proper LBP rounding

## 🏪 Enhanced Inventory Management Testing

### 3. Low Stock Dashboard

#### Test 3.1: Access Low Stock Dashboard
1. Login as **manager**
2. Navigate to "Inventory" tab
3. Verify "Low Stock Management Dashboard" appears at top
4. **Expected**: Dashboard loads with current low stock items

#### Test 3.2: Low Stock Filtering
1. In Low Stock Dashboard, test filter tabs:
   - Click "All Items" → Shows products + ingredients
   - Click "Products" → Shows only products below threshold
   - Click "Ingredients" → Shows only ingredients below threshold
2. **Expected**: Correct filtering with accurate counts

#### Test 3.3: Stock Adjustment via Dialog
1. Find low stock item in dashboard
2. Click "Restock" button
3. In Stock Adjustment Dialog:
   - Select "Add to Stock"
   - Enter quantity: `50`
   - Enter reason: "New shipment received"
   - Click "Confirm Adjustment"
4. **Expected**: Stock updated, item removed from low stock if above threshold

#### Test 3.4: Inventory Alert Button Navigation
1. Look for bell icon in header (inventory notifications)
2. Click notification bell
3. Click external link button (arrow icon)
4. **Expected**: Automatically navigates to Inventory tab and scrolls to Low Stock Dashboard

### 4. Enhanced Order Management

#### Test 4.1: Access Enhanced Order Management  
1. Login as **manager**
2. Navigate to "Orders" tab
3. Verify "Enhanced Order Management" section appears first
4. **Expected**: Table shows all orders with search and filter options

#### Test 4.2: Order Search & Filtering
1. In Enhanced Order Management:
   - Search by customer name: Enter "John"
   - Search by order number: Enter order number
   - Filter by status: Select "pending"
2. **Expected**: Results update in real-time, accurate filtering

#### Test 4.3: Order Editing
1. Find an order with status "pending" or "preparing"
2. Click edit button (pencil icon)
3. In edit dialog:
   - Update customer name
   - Change phone number
   - Update order status
   - Click "Save Changes"
4. **Expected**: Order updates successfully, changes reflected immediately

#### Test 4.4: Order Deletion (Critical Test)
1. Create a test order as cashier
2. Login as **manager**
3. Find the test order (should be "pending" status)
4. Click delete button (trash icon)
5. In confirmation dialog:
   - Verify order details displayed
   - Click "Delete Order"
6. **Expected**: Order removed from system, audit trail maintained

#### Test 4.5: Order Deletion Restrictions
1. Find an order with status "delivered"
2. Verify delete button is NOT present
3. Find an order with status "preparing"
4. Verify delete button IS present
5. **Expected**: Delete only available for pending/cancelled orders

### 5. Cost Management & Profit Analysis

#### Test 5.1: Access Cost Management
1. Login as **manager**
2. Navigate to "Cost Management" tab
3. **Expected**: Dashboard with cost overview cards and management tables

#### Test 5.2: Cost Overview Cards
1. Verify three overview cards:
   - "Product Inventory Value" (green)
   - "Ingredient Inventory Value" (blue)
   - "Items Missing Cost Data" (orange)
2. **Expected**: Accurate calculations and warnings for missing data

#### Test 5.3: Product Cost & Profit Analysis
1. In Cost Management, select "Products" tab
2. Find product without cost data
3. Click "Edit Cost" button
4. In cost dialog:
   - Enter cost: `$2.00` for product selling at `$4.00`
   - Verify profit calculation shows: `$2.00 profit`, `50% margin`
   - Click "Save Cost"
5. **Expected**: Cost saved, profit margin calculated correctly

#### Test 5.4: Ingredient Cost Management
1. Select "Ingredients" tab
2. Find ingredient without cost data
3. Click "Edit Cost" button
4. Enter cost per unit: `$0.05`
5. **Expected**: Cost saved, total value calculated (cost × stock quantity)

## 📊 Real-Time Features Testing

### 6. WebSocket & Real-Time Updates

#### Test 6.1: Order Status Updates
1. **Setup**: Two browser windows - one as cashier, one as barista
2. **Cashier**: Create new order
3. **Barista**: Verify order appears in queue immediately
4. **Barista**: Update order status to "preparing"
5. **Cashier**: Verify status update appears without refresh
6. **Expected**: Real-time synchronization across all interfaces

#### Test 6.2: Inventory Updates
1. **Setup**: Two windows - both as manager on inventory tab
2. **Window 1**: Adjust stock for a product
3. **Window 2**: Verify stock update appears without refresh
4. **Expected**: Live inventory synchronization

### 7. Advanced Inventory Features

#### Test 7.1: Recipe-Based Product Stock Deduction
1. Create order with recipe-based product (e.g., Latte with coffee beans ingredient)
2. Process order to "delivered" status
3. Check ingredient stock (coffee beans should decrease)
4. Verify inventory log shows ingredient deduction
5. **Expected**: Automatic ingredient deduction based on recipe quantities

#### Test 7.2: Low Stock Alerts
1. Reduce product stock below minimum threshold
2. Verify low stock alert appears in:
   - Inventory notifications (bell icon)
   - Low stock dashboard
   - Manager dashboard alerts
3. **Expected**: Multi-channel low stock notifications

## 🎯 Advanced Testing Scenarios

### 8. Error Handling & Edge Cases

#### Test 8.1: Insufficient Stock Orders
1. Set product stock to 1 unit
2. Try to order 3 units of that product
3. **Expected**: Error message, order blocked or adjusted

#### Test 8.2: Invalid Cost Data
1. Try to enter negative cost: `-$5.00`
2. Try to enter non-numeric cost: `abc`
3. **Expected**: Validation errors, invalid data rejected

#### Test 8.3: Order Deletion Edge Cases
1. Try to delete order as **cashier** (should fail)
2. Try to delete "delivered" order as **manager** (should be disabled)
3. **Expected**: Proper permission and status checks

### 9. Performance & Load Testing

#### Test 9.1: Large Order Processing
1. Create order with 10+ different products
2. Process through all status stages
3. Verify performance remains smooth
4. **Expected**: No lag or errors with complex orders

#### Test 9.2: Concurrent User Actions
1. **Setup**: 3 users simultaneously (cashier, barista, manager)
2. **All users**: Perform actions simultaneously
3. **Expected**: No data corruption, proper synchronization

### 10. Data Integrity Testing

#### Test 10.1: Ingredient Stock Calculation
1. Create recipe: "Cappuccino" using 18g coffee beans
2. Create order for 2 Cappuccinos
3. Verify: Coffee beans stock decreases by 36g (18g × 2)
4. Check inventory log for audit trail
5. **Expected**: Accurate ingredient calculations and logging

#### Test 10.2: Cost Calculation Accuracy
1. Set product cost: $2.50, selling price: $5.00
2. Verify profit margin: 50%
3. Verify profit amount: $2.50
4. Create inventory with 100 units
5. Verify total value: $250.00
6. **Expected**: All calculations mathematically correct

## 🔍 UI/UX Testing

### 11. User Interface Testing

#### Test 11.1: Responsive Design
1. Test on desktop (1920×1080)
2. Test on tablet (iPad sized)
3. Test on mobile (iPhone sized)
4. **Expected**: All interfaces remain functional and readable

#### Test 11.2: Touch Interface (Tablet)
1. Test all buttons on tablet
2. Verify minimum 44px touch targets
3. Test gestures and scrolling
4. **Expected**: Smooth touch interactions, no accidental clicks

#### Test 11.3: Accessibility
1. Tab through all interactive elements
2. Test screen reader compatibility (if available)
3. Verify sufficient color contrast
4. **Expected**: Accessible to users with disabilities

## 📋 Complete Test Checklist

### Pre-Deployment Testing Checklist

- [ ] All user roles can login successfully
- [ ] Role permissions properly enforced
- [ ] POS system creates orders correctly
- [ ] Dual currency display accurate
- [ ] Barcode scanning functional
- [ ] Low Stock Dashboard shows accurate data
- [ ] Stock adjustment dialog works correctly
- [ ] Order search and filtering functional
- [ ] Order editing saves changes
- [ ] Order deletion works with proper restrictions
- [ ] Cost management calculates profit margins correctly
- [ ] Ingredient cost updates save properly
- [ ] Real-time updates work across browsers
- [ ] Recipe-based stock deduction functional
- [ ] Inventory alerts trigger correctly
- [ ] Error handling prevents invalid operations
- [ ] UI responsive across devices
- [ ] Performance acceptable under load
- [ ] Data integrity maintained throughout

### Post-Deployment Verification

- [ ] Production database connection stable
- [ ] All APIs responding correctly
- [ ] WebSocket connections established
- [ ] File uploads working (if applicable)
- [ ] Email notifications functional (if configured)
- [ ] Backup systems operational
- [ ] SSL certificates valid
- [ ] Performance monitoring active

## 🚨 Critical Issue Escalation

If any of these critical issues occur during testing, escalate immediately:

1. **Data Loss**: Orders, inventory, or users disappearing
2. **Security Breach**: Unauthorized access to admin functions
3. **Payment Errors**: Incorrect calculations or failed transactions
4. **Inventory Corruption**: Stock levels showing incorrect values
5. **System Crashes**: Application becomes unresponsive
6. **Database Errors**: Connection failures or data corruption

## 📊 Testing Report Template

After completing tests, document results using this template:

```
## Test Results - [Date]

### Tested By: [Name]
### Environment: [Development/Staging/Production]
### Browser: [Chrome/Firefox/Safari]
### Device: [Desktop/Tablet/Mobile]

### Passed Tests: X/Y
### Failed Tests: List specific failures
### Critical Issues: List any critical issues
### Recommendations: Next steps or improvements

### Detailed Results:
- [Test 1.1]: PASS/FAIL - Notes
- [Test 1.2]: PASS/FAIL - Notes
...
```

## 🔧 Troubleshooting Common Issues

### Issue: Low Stock Dashboard Not Loading
- **Solution**: Check network connection, refresh browser, verify manager permissions

### Issue: Order Deletion Not Working
- **Solution**: Ensure user has manager/admin role, verify order status is pending/cancelled

### Issue: Cost Calculations Incorrect
- **Solution**: Verify cost data entered as decimal numbers, check for special characters

### Issue: Real-Time Updates Not Working
- **Solution**: Check WebSocket connection, ensure network stability, refresh page

---

**Testing Completion**: After all tests pass, the system is ready for production deployment. Document any issues found and ensure they are resolved before go-live.

<function_calls>
<invoke name="mark_completed_and_get_feedback">
<parameter name="workflow_name">Start application