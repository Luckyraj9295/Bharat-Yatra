# 💰 Refund Approval System - User Guide

## Overview
The refund approval system has **3 stages**:
1. ✅ **User requests cancellation** (in BookHist.html)
2. ⏳ **Admin reviews and approves/rejects** (in admin refunds page)
3. 💳 **Razorpay processes the refund** (automatic after approval)

---

## 📍 Where to Approve Refunds?

### For Admins: Access Refund Approvals Page
1. Go to **Admin Dashboard**: `/admin/admin.html`
2. Click **"💰 Refund Approvals"** button (top right)
3. You'll see a list of all pending refund requests

### Refund Approval Panel Features:
- **Filter by Status**: View All / Pending / Approved / Rejected
- **Review Details**: Click "Review" button to see:
  - Booking Ref
  - Customer Email
  - Refund Amount (₹)
  - Cancellation Reason
- **Approve or Reject**: 
  - Click "Approve" → Refund is processed to Razorpay immediately
  - Click "Reject" → Refund is marked as rejected
- **Add Reason**: Optional approval/rejection reason (shown in logs)

---

## 🔄 Complete Refund Flow

### User Side (BookHist.html):
```
1. User views booking in "My Bookings"
2. Clicks "Cancel Booking"
3. Modal shows:
   - Refund policy (100%/50%/0% based on cancellation date)
   - Refund amount calculation
4. User clicks "Cancel & Request Refund"
5. Status shows: "⏳ Refund Awaiting Admin Approval"
```

### Admin Side (admin/refunds.html):
```
1. Admin logs in and goes to "Refund Approvals"
2. Sees pending refund requests in table
3. Clicks "Review" button
4. Modal shows booking details and refund amount
5. Admin clicks:
   - "Approve" → Refund sent to Razorpay (user gets money back)
   - "Reject" → Refund cancelled (user doesn't get money)
6. Refund status updates to "Completed" or "Rejected"
```

### Backend Endpoints:
```
POST /api/payments/refund
  - Called by: User (via BookHist.html)
  - Creates refund request with status: "pending"
  
POST /api/payments/admin/refund-approval
  - Called by: Admin (via refunds.html)
  - Action: "approve" or "reject"
  - If approve: Processes Razorpay refund immediately
```

---

## 📊 Refund Policy

| Cancellation Time | Refund % | Example |
|---|---|---|
| More than 14 days before trip | **100%** | Trip on 20th, cancel on 1st = Full refund ✅ |
| 7-14 days before trip | **50%** | Trip on 20th, cancel on 10th = Half refund 💰 |
| Less than 7 days before trip | **0%** | Trip on 20th, cancel on 18th = No refund ❌ |

---

## 🎯 Key Features

✅ **Payment Status Validation**
- Can only request refund if payment status is "completed"
- Prevents orphaned refunds for unpaid bookings

✅ **Admin Approval Workflow**
- Refunds don't auto-process to Razorpay
- Requires explicit admin review and approval
- Professional audit trail

✅ **Real-time Updates**
- Admin page auto-refreshes every 30 seconds
- Users see status updates immediately after approval

✅ **Detailed Tracking**
- Refund ID (from Razorpay)
- Completion timestamp
- Admin notes/reason

---

## 🔑 Important Notes

1. **Only Cancelled Bookings**: Only bookings with `bookingStatus: 'cancelled'` appear in refunds page

2. **Multiple Refund Statuses**:
   - `none` = No refund requested
   - `pending` = Awaiting admin approval
   - `approved` = Admin approved (Razorpay refund processed)
   - `rejected` = Admin rejected (no refund)
   - `completed` = Refund deposited to user

3. **Razorpay Integration**:
   - When admin approves: Refund automatically sent to Razorpay
   - Razorpay refund ID stored in database: `booking.razorpayRefundId`
   - Funds typically reach user within 3-5 business days

4. **Invoice & Records**:
   - BookHist invoices show refund details:
     - Refund amount
     - Refund percentage
     - Cancellation reason
     - Refund status

---

## 📱 For Users: How to Track Your Refund

In **BookHist.html** > Booking Details:
- **Status Badge**: Shows "✓ Refund: ₹XXXX" once approved
- **Refund Status**: Shows "Pending Approval" → "Completed"
- **Invoice PDF**: Includes refund details
- **Timeline**:
  1. Cancel booking → Status: "Pending Approval"
  2. Admin approves → Status: "Completed"
  3. Razorpay processes → Money returns to original payment method

---

## 🚀 Testing the System

### Test Scenario:
1. **Create booking** and pay with test Razorpay card
2. **Request cancellation** from BookHist
3. **Check refund status** → Should show "Pending Approval"
4. **Login as admin** and go to Refunds page
5. **Click Review** on the pending request
6. **Click Approve** → Status updates to "Completed"
7. **Check refund in Razorpay Dashboard**

### Test Cards (Razorpay):
- **Visa**: 4111111111111111 (any future date, any CVV)
- **Debit**: 5105105105105100
- **UPI**: success@razorpay (simulates success)

---

## 📞 Support

If refunds don't appear:
1. Check booking `paymentStatus` = 'completed'
2. Check booking `bookingStatus` = 'cancelled'
3. Verify admin login (needs Bearer token)
4. Check browser console for API errors

Still not working? Check:
- `.env` file has Razorpay live keys
- Payment was actually processed before cancellation
- User and admin roles are set correctly
