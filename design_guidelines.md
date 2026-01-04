# Design Guidelines: Shopify Influencer Analytics Application

## Design Approach

**Selected Framework**: Shopify Polaris Design System
**Rationale**: This is a Shopify embedded app requiring seamless integration with the merchant admin experience. Polaris ensures consistency, familiarity, and access to pre-built components optimized for data-heavy business tools.

## Core Design Principles

1. **Visual Recognition First**: Profile images drive instant influencer identification throughout the interface
2. **Data Clarity**: Financial metrics and ROI indicators must be immediately scannable
3. **Efficient Workflows**: Reduce cognitive load through consistent patterns and visual hierarchies
4. **Trust Through Precision**: Every number, status, and financial calculation displayed with absolute clarity

## Typography System

**Font Stack**: Use Shopify Polaris default (SF Pro / Inter fallback)

Hierarchy:
- Page Titles: 24px, semibold
- Section Headers: 18px, semibold  
- Card Titles: 16px, medium
- Body Text: 14px, regular
- Data Tables: 13px, regular
- Supporting Text: 12px, regular
- Financial Figures: 16px, medium (tabular numbers)

## Layout System

**Spacing Units**: Polaris spacing scale - use units of 4, 8, 12, 16, 20, 24, 32
- Page margins: 20px (mobile), 32px (desktop)
- Card padding: 16px (mobile), 20px (desktop)
- Section spacing: 24px between major sections
- Form field spacing: 12px vertical gaps
- Table row height: 48px minimum for avatar visibility

**Grid Structure**:
- Dashboard tables: Full-width with horizontal scroll on mobile
- Form layouts: Single column (mobile), 2-column (desktop 768px+)
- Card grids: 1 column (mobile), 2 columns (tablet), 3 columns (desktop 1200px+)

## Component Library

### Navigation
- Top bar with app branding and merchant context
- Side navigation: Influencers, Campaigns, Analytics, Settings
- Breadcrumbs for deep navigation states

### Influencer CRM Interface
**Profile Card**:
- 64px circular avatar (top-left or centered)
- Name (18px, semibold) adjacent to avatar
- Social platform badges (Instagram/TikTok/Snap icons with follower counts)
- Star rating display (1-5 stars, visual not numeric)
- Action buttons: Edit, Delete (secondary style)

**Creation/Edit Form**:
- Avatar upload zone: 120px circle with drag-drop area
- Auto-fetch indicator when entering Instagram handle
- Fallback upload button and URL input field
- Form fields with clear labels and helper text
- Social accounts as repeatable field group

### Campaign Builder
**Influencer Selector**:
- Dropdown with 40px avatars in options list
- Search/filter functionality
- Display: Avatar + Name + Primary Platform

**Configuration Sections**:
- Tracking Setup: UTM slug generator with edit capability
- Promo Code: Text input with validation
- Financial: Labeled currency inputs (fixed cost, commission %)
- Submit actions: Primary CTA + Secondary cancel

### Analytics Dashboard

**Main Data Table**:
Column Structure:
1. Influencer: 40px avatar + name (fixed left on scroll)
2. Campaign: Name + status badge
3. Engagement: Clicks, Add-to-carts (numeric, aligned right)
4. Orders: Count + promo code usage indicator
5. Revenue: Currency formatted
6. Costs: Total breakdown (fixed + commission)
7. ROI: Percentage with conditional indicator (positive/negative visual treatment)

**Table Features**:
- Sortable columns (arrows on headers)
- Row hover states for clarity
- Pagination controls (bottom)
- Export action (top-right)
- Filters (top-left): Date range, status, influencer

**Financial Indicators**:
- Use Polaris Badge component for positive/negative ROI
- Numeric data right-aligned in tables
- Currency symbols consistent

### Cards & Containers
- Use Polaris Card component consistently
- Section headings within cards (16px, medium)
- Dividers between logical groups
- Footer actions right-aligned

### Status & Feedback
- Loading states: Polaris Spinner
- Empty states: Icon + message + CTA
- Error handling: Inline validation + Banner notifications
- Success confirmations: Toast messages

## Images

**Profile Images**:
- Influencer avatars: Circular, 40px (tables), 64px (cards), 120px (profiles)
- Fallback to initials when no image available
- Upload interface: Drag-drop zone with preview
- Supported: Auto-fetch from Instagram API or manual upload

**No Hero Images**: This is a data application, not a marketing site. Focus on efficient data display.

## Interaction Patterns

**Primary Actions**: Polaris primary button style (create, save, confirm)
**Secondary Actions**: Polaris secondary button style (cancel, edit)
**Destructive Actions**: Polaris destructive button style (delete)

**Hover States**: Follow Polaris specifications
**Focus States**: Clear keyboard navigation indicators
**Loading States**: Skeleton screens for table data, spinners for actions

## Responsive Behavior

**Mobile (< 768px)**:
- Stack table columns into cards
- Hamburger navigation
- Full-width forms
- Maintain avatar visibility in compact layouts

**Tablet (768px - 1200px)**:
- Horizontal scrolling tables with fixed first column
- 2-column forms

**Desktop (1200px+)**:
- Full table display
- 3-column card grids
- Side navigation always visible

## Accessibility

- WCAG AA contrast ratios throughout
- Keyboard navigation for all interactive elements
- ARIA labels for icon buttons
- Screen reader announcements for dynamic updates
- Focus trap in modals
- Alt text for all profile images