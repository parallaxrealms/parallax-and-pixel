# Sidebar Component System

## Overview
The sidebar system provides a clean, configurable sidebar component with comprehensive control over every aspect of styling and behavior. Based on the `sidebar.md` specification, this system offers granular control over all visual elements.

## Components
- `Sidebar.svelte` - Main sidebar component
- `SidebarItem.svelte` - Individual sidebar item component
- `SidebarExample.svelte` - Interactive demo component

## Configuration Structure

The configuration system is organized into logical groups matching the `sidebar.md` specification:

### Sidebar Container Variables
```typescript
sidebar: {
  widthExpanded: string;        // --sidebar-width-expanded
  widthCollapsed: string;       // --sidebar-width-collapsed
  bg: string;                   // --sidebar-bg
  border: string;               // --sidebar-border
  padding: string;              // --sidebar-padding
  margin: string;               // --sidebar-margin
  gap: string;                  // --sidebar-gap
  radiusContainer: string;      // --sidebar-radius-container
  radiusItem: string;           // --sidebar-radius-item
  radiusButton: string;         // --sidebar-radius-button
  radiusChildItem: string;      // --sidebar-radius-child-item
  alignContentExpanded: 'start' | 'center' | 'end';
  alignContentCollapsed: 'start' | 'center' | 'end';
}
```

### Expanded Item Variables
```typescript
expandedItem: {
  padding: string;              // --sidebar-item-expanded-padding
  margin: string;               // --sidebar-item-expanded-margin
  height: string;               // --sidebar-item-expanded-height
  width: string;                // --sidebar-item-expanded-width
  contentSpacing: string;       // --sidebar-item-expanded-content-spacing
  bgColor: string;              // --sidebar-item-expanded-bg-color
  bgHoverColor: string;         // --sidebar-item-expanded-bg-hover-color
  bgActiveColor: string;        // --sidebar-item-expanded-bg-active-color
  borderColor: string;          // --sidebar-item-expanded-border-color
  borderHoverColor: string;     // --sidebar-item-expanded-border-hover-color
  borderActiveColor: string;    // --sidebar-item-expanded-border-active-color
  textColor: string;            // --sidebar-item-expanded-text-color
  textHoverColor: string;       // --sidebar-item-expanded-text-hover-color
  textActiveColor: string;      // --sidebar-item-expanded-text-active-color
  textSize: string;             // --sidebar-item-expanded-text-size
  iconColor: string;            // --sidebar-item-expanded-icon-color
  iconHoverColor: string;       // --sidebar-item-expanded-icon-hover-color
  iconActiveColor: string;      // --sidebar-item-expanded-icon-active-color
  iconSize: string;             // --sidebar-item-expanded-icon-size
}
```

### Expanded Child Item Variables
```typescript
expandedChildItem: {
  padding: string;              // --sidebar-item-expanded-child-padding
  margin: string;               // --sidebar-item-expanded-child-margin
  height: string;               // --sidebar-item-expanded-child-height
  width: string;                // --sidebar-item-expanded-child-width
  contentSpacing: string;       // --sidebar-item-expanded-child-content-spacing
  indent: string;               // --sidebar-item-expanded-child-indent
  bgColor: string;              // --sidebar-item-expanded-child-bg-color
  bgHoverColor: string;         // --sidebar-item-expanded-child-bg-hover-color
  bgActiveColor: string;        // --sidebar-item-expanded-child-bg-active-color
  borderColor: string;          // --sidebar-item-expanded-child-border-color
  borderHoverColor: string;     // --sidebar-item-expanded-child-border-hover-color
  borderActiveColor: string;    // --sidebar-item-expanded-child-border-active-color
  borderSize: string;           // --sidebar-item-expanded-child-border-size
  textColor: string;            // --sidebar-item-expanded-child-text-color
  textHoverColor: string;       // --sidebar-item-expanded-child-text-hover-color
  textActiveColor: string;      // --sidebar-item-expanded-child-text-active-color
  textSize: string;             // --sidebar-item-expanded-child-text-size
  iconColor: string;            // --sidebar-item-expanded-child-icon-color
  iconHoverColor: string;       // --sidebar-item-expanded-child-icon-hover-color
  iconActiveColor: string;      // --sidebar-item-expanded-child-icon-active-color
  iconSize: string;             // --sidebar-item-expanded-child-icon-size
}
```

### Collapsed Item Variables
```typescript
collapsedItem: {
  padding: string;              // --sidebar-item-collapsed-padding
  margin: string;               // --sidebar-item-collapsed-margin
  height: string;               // --sidebar-item-collapsed-height
  width: string;                // --sidebar-item-collapsed-width
  bgColor: string;              // --sidebar-item-collapsed-bg-color
  bgHoverColor: string;         // --sidebar-item-collapsed-bg-hover-color
  bgActiveColor: string;        // --sidebar-item-collapsed-bg-active-color
  iconColor: string;            // --sidebar-item-collapsed-icon-color
  iconHoverColor: string;       // --sidebar-item-collapsed-icon-hover-color
  iconActiveColor: string;      // --sidebar-item-collapsed-icon-active-color
  iconSize: string;             // --sidebar-item-collapsed-icon-size
}
```

### Collapsed Child Item Variables
```typescript
collapsedChildItem: {
  padding: string;              // --sidebar-item-collapsed-child-padding
  margin: string;               // --sidebar-item-collapsed-child-margin
  height: string;               // --sidebar-item-collapsed-child-height
  width: string;                // --sidebar-item-collapsed-child-width
  indent: string;               // --sidebar-item-collapsed-child-indent
  bgColor: string;              // --sidebar-item-collapsed-child-bg-color
  bgHoverColor: string;         // --sidebar-item-collapsed-child-bg-hover-color
  bgActiveColor: string;        // --sidebar-item-collapsed-child-bg-active-color
  iconColor: string;            // --sidebar-item-collapsed-child-icon-color
  iconHoverColor: string;       // --sidebar-item-collapsed-child-icon-hover-color
  iconActiveColor: string;      // --sidebar-item-collapsed-child-icon-active-color
  iconSize: string;             // --sidebar-item-collapsed-child-icon-size
  borderColor: string;          // --sidebar-item-collapsed-child-border-color
  borderHoverColor: string;     // --sidebar-item-collapsed-child-border-hover-color
  borderActiveColor: string;    // --sidebar-item-collapsed-child-border-active-color
  borderSize: string;           // --sidebar-item-collapsed-child-border-size
}
```

### Animation Variables
```typescript
animations: {
  sidebarDuration: string;      // --sidebar-duration
  sidebarEasing: string;        // --sidebar-easing
  sidebarHoverScale: number;    // --sidebar-hover-scale
  sidebarItemDuration: string;  // --sidebar-item-duration
  sidebarItemDropdownEasing: string;    // --sidebar-item-dropdown-easing
  sidebarItemDropdownDuration: string;  // --sidebar-item-dropdown-duration
}
```

## Usage Examples

### Basic Configuration
```svelte
<script>
import { Sidebar } from '$lib/components/custom/sidebar/Sidebar.svelte';
import { createSidebarConfig } from '$lib/utils/sidebarConfig';

const config = createSidebarConfig()
  .sidebar({
    widthExpanded: '15rem',
    widthCollapsed: '4rem',
    bg: 'var(--color-surface)',
    alignContentCollapsed: 'center'
  })
  .expandedItem({
    iconSize: '1.5rem',
    textSize: '1rem',
    contentSpacing: '1rem'
  })
  .collapsedItem({
    iconSize: '1.75rem'
  })
  .build();
</script>

<Sidebar {config} {items} />
```

### Advanced Customization
```svelte
<script>
const customConfig = createSidebarConfig()
  .sidebar({
    widthExpanded: '16rem',
    widthCollapsed: '3.5rem',
    bg: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    border: '1px solid #0f3460',
    radiusContainer: '0.5rem',
    alignContentExpanded: 'start',
    alignContentCollapsed: 'center'
  })
  .expandedItem({
    padding: '1rem',
    height: '3.5rem',
    contentSpacing: '1rem',
    bgColor: 'transparent',
    bgHoverColor: 'rgba(15, 52, 96, 0.3)',
    bgActiveColor: '#0f3460',
    textColor: '#e0e6ed',
    textHoverColor: '#ffffff',
    textActiveColor: '#ffffff',
    textSize: '0.9rem',
    iconColor: '#a0aec0',
    iconHoverColor: '#e0e6ed',
    iconActiveColor: '#ffffff',
    iconSize: '1.5rem'
  })
  .expandedChildItem({
    padding: '0.75rem',
    height: '3rem',
    indent: '1.5rem',
    contentSpacing: '0.75rem',
    borderColor: '#0f3460',
    borderSize: '2px',
    textColor: '#a0aec0',
    textHoverColor: '#e0e6ed',
    iconColor: '#718096',
    iconHoverColor: '#a0aec0',
    iconSize: '1.25rem'
  })
  .collapsedItem({
    height: '3.5rem',
    width: '3.5rem',
    iconSize: '1.75rem',
    iconColor: '#a0aec0',
    iconHoverColor: '#e0e6ed',
    iconActiveColor: '#ffffff'
  })
  .collapsedChildItem({
    height: '3.5rem',
    width: '3.5rem',
    iconSize: '1.5rem',
    borderColor: '#0f3460',
    borderSize: '3px',
    iconColor: '#718096',
    iconHoverColor: '#a0aec0'
  })
  .animations({
    sidebarDuration: '0.4s',
    sidebarEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    sidebarHoverScale: 1.05,
    sidebarItemDuration: '0.25s',
    sidebarItemDropdownEasing: 'ease-out',
    sidebarItemDropdownDuration: '0.35s'
  })
  .build();
</script>

<Sidebar {config} {items} />
```

## Predefined Configurations

### Default
```typescript
const defaultConfig = createSidebarConfig().build();
```

### Compact
```typescript
const compactConfig = createSidebarConfig()
  .sidebar({
    widthExpanded: '10rem',
    widthCollapsed: '2.5rem'
  })
  .expandedItem({
    padding: '0.5rem',
    height: '2.5rem',
    contentSpacing: '0.5rem',
    textSize: '0.75rem',
    iconSize: '1rem'
  })
  .collapsedItem({
    height: '2.5rem',
    width: '2.5rem',
    iconSize: '1rem'
  })
  .build();
```

### Rounded
```typescript
const roundedConfig = createSidebarConfig()
  .sidebar({
    radiusContainer: 'var(--border-radius-lg)',
    radiusItem: 'var(--border-radius-lg)',
    radiusButton: 'var(--border-radius-lg)',
    radiusChildItem: 'var(--border-radius-lg)'
  })
  .build();
```

### Colorful
```typescript
const colorfulConfig = createSidebarConfig()
  .sidebar({
    bg: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-hover))',
    border: 'var(--color-primary)'
  })
  .expandedItem({
    bgHoverColor: 'rgba(var(--color-primary-rgb), 0.1)',
    textHoverColor: 'var(--color-primary)',
    iconHoverColor: 'var(--color-primary)'
  })
  .build();
```

## Features

### Comprehensive Control
- **Every visual aspect** is configurable through CSS variables
- **State-specific styling** for expanded vs collapsed states
- **Item-specific styling** for parent vs child items
- **Hover and active states** for all elements
- **Animation control** for all transitions

### Collapsed Children Support
When the sidebar is collapsed, clicking a parent item with children will:
- Expand the children with special styling
- Show icons with configurable sizing
- Apply primary color left border
- Auto-collapse when clicking other items

### Auto-Collapse
When clicking a different tab, any expanded children automatically collapse.

### Admin Role Support
Items can be marked as `adminOnly: true` to show only for admin users.

## CSS Variable Naming

All CSS variables follow the naming convention from `sidebar.md`:
- Container variables: `--sidebar-*`
- Expanded item variables: `--sidebar-item-expanded-*`
- Expanded child variables: `--sidebar-item-expanded-child-*`
- Collapsed item variables: `--sidebar-item-collapsed-*`
- Collapsed child variables: `--sidebar-item-collapsed-child-*`
- Animation variables: `--sidebar-*` and `--sidebar-item-*`

## Migration from Old Sidebar
Use `SidebarMigration.svelte` as a drop-in replacement that wraps the new system with the old API.