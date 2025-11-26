// frontend/src/routes/agreementRoutes.tsx
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy loading компонентов
const Agreements = lazy(() => import('@/modules/Agreements'));
const AgreementDetail = lazy(() => import('@/modules/Agreements/AgreementDetail'));
const AgreementTemplates = lazy(() => import('@/modules/Agreements/Templates'));
const CreateTemplate = lazy(() => import('@/modules/Agreements/Templates/CreateTemplate'));
const PublicAgreement = lazy(() => import('@/modules/Agreements/Public/PublicAgreement'));
const SignAgreement = lazy(() => import('@/modules/Agreements/Public/SignAgreement'));

// Защищенные роуты (требуют авторизации)
export const protectedAgreementRoutes: RouteObject[] = [
  {
    path: '/agreements',
    element: <Agreements />
  },
  {
    path: '/agreements/:id',
    element: <AgreementDetail />
  },
  {
    path: '/agreements/templates',
    element: <AgreementTemplates />
  },
  {
    path: '/agreements/templates/create',
    element: <CreateTemplate />
  },
  {
    path: '/agreements/templates/:id',
    element: <AgreementDetail /> // Можно создать отдельный компонент для просмотра шаблона
  },
  {
    path: '/agreements/templates/:id/edit',
    element: <CreateTemplate /> // Переиспользуем компонент создания для редактирования
  }
];

// Публичные роуты (не требуют авторизации)
export const publicAgreementRoutes: RouteObject[] = [
  {
    path: '/agreement/:link',
    element: <PublicAgreement />
  },
  {
    path: '/sign/:link',
    element: <SignAgreement />
  }
];