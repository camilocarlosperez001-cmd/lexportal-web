import { defineTextStyles } from '@chakra-ui/react'

export const textStyles = defineTextStyles({
  display: { value: { fontSize: '40px', lineHeight: '48px', fontWeight: '700', letterSpacing: '-0.02em' } },
  'headline-lg': { value: { fontSize: '30px', lineHeight: '38px', fontWeight: '600', letterSpacing: '-0.015em' } },
  'headline-lg-mobile': { value: { fontSize: '24px', lineHeight: '32px', fontWeight: '600', letterSpacing: '-0.01em' } },
  'headline-md': { value: { fontSize: '24px', lineHeight: '32px', fontWeight: '600', letterSpacing: '-0.01em' } },
  'headline-sm': { value: { fontSize: '20px', lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.005em' } },
  'title-md': { value: { fontSize: '16px', lineHeight: '24px', fontWeight: '600' } },
  'title-sm': { value: { fontSize: '14px', lineHeight: '20px', fontWeight: '600', letterSpacing: '0.005em' } },
  'body-lg': { value: { fontSize: '16px', lineHeight: '26px', fontWeight: '400' } },
  'body-md': { value: { fontSize: '14px', lineHeight: '22px', fontWeight: '400' } },
  'body-sm': { value: { fontSize: '12px', lineHeight: '18px', fontWeight: '400', letterSpacing: '0.01em' } },
  'label-md': { value: { fontSize: '14px', lineHeight: '20px', fontWeight: '500', letterSpacing: '0.01em' } },
  'label-sm': { value: { fontSize: '12px', lineHeight: '16px', fontWeight: '500', letterSpacing: '0.02em' } },
  'label-caps': { value: { fontSize: '11px', lineHeight: '16px', fontWeight: '600', letterSpacing: '0.06em' } },
})
