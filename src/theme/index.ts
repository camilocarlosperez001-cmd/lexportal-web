import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'
import { colors } from './colors'
import { textStyles } from './text-styles'

// La cabecera de DESIGN.md prevalece sobre los colores alternativos de su prosa.
const config = defineConfig({
  globalCss: {
    html: { colorPalette: 'brand' },
    body: { bg: 'bg', color: 'fg', fontFamily: 'body', textStyle: 'body-md' },
    '*': { borderColor: 'border' },
    '*:focus-visible': { outline: '2px solid', outlineColor: 'border.focus', outlineOffset: '3px' },
    '::selection': { bg: 'secondary-container', color: 'on-secondary-fixed' },
  },
  theme: {
    breakpoints: { sm: '480px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    tokens: {
      colors: {
        ...colors,
        focus: { value: '#3182ce' },
        success: { value: '#22543d' },
        'success-bg': { value: '#f0fff4' },
        warning: { value: '#744210' },
        'warning-bg': { value: '#fffaf0' },
        info: { value: '#2b6cb0' },
        'info-bg': { value: '#ebf8ff' },
      },
      fonts: {
        heading: { value: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
        body: { value: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
      },
      spacing: {
        gutter: { value: '1.5rem' }, 'gutter-mobile': { value: '1rem' },
        margin: { value: '2rem' }, 'margin-mobile': { value: '1rem' },
        'space-xs': { value: '0.25rem' }, 'space-sm': { value: '0.5rem' },
        'space-md': { value: '1rem' }, 'space-lg': { value: '1.5rem' }, 'space-xl': { value: '2rem' },
      },
      radii: {
        sm: { value: '0.125rem' }, base: { value: '0.25rem' }, md: { value: '0.375rem' },
        lg: { value: '0.5rem' }, xl: { value: '0.75rem' }, full: { value: '9999px' },
      },
      shadows: {
        card: { value: '0 1px 3px rgb(0 0 0 / 0.05), 0 1px 2px rgb(0 0 0 / 0.03)' },
        dropdown: { value: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -1px rgb(0 0 0 / 0.04)' },
        dialog: { value: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -2px rgb(0 0 0 / 0.03)' },
        focus: { value: '0 0 0 3px rgb(49 130 206 / 0.25)' },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: '{colors.surface}' }, panel: { value: '{colors.surface-container-lowest}' },
          subtle: { value: '{colors.surface-container-low}' }, muted: { value: '{colors.surface-container}' },
          emphasized: { value: '{colors.surface-container-high}' }, inverted: { value: '{colors.inverse-surface}' },
          success: { value: '{colors.success-bg}' }, warning: { value: '{colors.warning-bg}' },
          info: { value: '{colors.info-bg}' }, error: { value: '{colors.error-container}' },
        },
        fg: {
          DEFAULT: { value: '{colors.on-surface}' }, muted: { value: '{colors.on-surface-variant}' },
          subtle: { value: '{colors.secondary}' }, inverted: { value: '{colors.inverse-on-surface}' },
          success: { value: '{colors.success}' }, warning: { value: '{colors.warning}' },
          info: { value: '{colors.info}' }, error: { value: '{colors.error}' },
        },
        border: {
          DEFAULT: { value: '{colors.outline-variant}' }, muted: { value: '{colors.surface-container}' },
          subtle: { value: '{colors.surface-container-high}' }, emphasized: { value: '{colors.outline}' },
          focus: { value: '{colors.focus}' }, error: { value: '{colors.error}' },
        },
        brand: {
          solid: { value: '{colors.primary}' }, contrast: { value: '{colors.on-primary}' },
          fg: { value: '{colors.primary}' }, subtle: { value: '{colors.surface-container-low}' },
          muted: { value: '{colors.surface-container}' }, emphasized: { value: '{colors.surface-container-high}' },
          focusRing: { value: '{colors.focus}' },
        },
      },
    },
    textStyles,
    recipes: {
      button: {
        base: { borderRadius: 'md', textStyle: 'label-md', _focusVisible: { boxShadow: 'focus' } },
        variants: { variant: { solid: { _hover: { bg: 'colorPalette.solid/90' } } } },
      },
      input: {
        base: { borderRadius: 'md', bg: 'bg.panel', _placeholder: { color: 'fg.subtle' } },
        variants: {
          size: { sm: { h: '8' }, md: { h: '10' } },
          variant: { outline: { borderColor: 'border', _hover: { borderColor: 'border.emphasized' }, _focusVisible: { borderColor: 'border.focus', boxShadow: 'focus' } } },
        },
      },
      textarea: { base: { borderRadius: 'md', bg: 'bg.panel', _placeholder: { color: 'fg.subtle' } } },
      badge: { base: { borderRadius: 'full', textStyle: 'label-sm', minH: '6', px: '2' } },
    },
    slotRecipes: {
      card: { slots: ['root', 'header', 'body', 'footer', 'title', 'description'], base: { root: { borderRadius: 'lg', bg: 'bg.panel', boxShadow: 'card', borderColor: 'border' }, body: { p: 'space-lg' } } },
      dialog: { slots: ['trigger', 'backdrop', 'positioner', 'content', 'title', 'description', 'closeTrigger', 'header', 'body', 'footer'], base: { content: { borderRadius: 'lg', bg: 'bg.panel', boxShadow: 'dialog' } } },
    },
  },
})

export const system = createSystem(defaultConfig, config)
