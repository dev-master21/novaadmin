import { RouteObject } from 'react-router-dom';
import ChatHistory from '@/modules/Requests/Public/ChatHistory';
import ClientRequest from '@/modules/Requests/Public/ClientRequest';

const requestRoutes: RouteObject[] = [
  {
    path: '/request/chat/:chatUuid',
    element: <ChatHistory />
  },
  {
    path: '/request/client/:uuid',
    element: <ClientRequest />
  }
];

export default requestRoutes;