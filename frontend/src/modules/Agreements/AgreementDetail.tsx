// frontend/src/modules/Agreements/AgreementDetail.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Badge,
  Stack,
  Group,
  Text,
  Title,
  Tabs,
  Table,
  Drawer,
  Switch,
  Menu,
  Grid,
  ActionIcon,
  Progress,
  Center,
  Loader,
  Paper,
  Divider,
  TextInput,
  CopyButton,
  Affix,
  Transition,
  useMantineTheme,
  Box,
  RingProgress
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMediaQuery, useWindowScroll } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconLink,
  IconDeviceFloppy,
  IconX,
  IconFileText,
  IconCode,
  IconDeviceMobile,
  IconDeviceDesktop,
  IconCheck,
  IconRefresh,
  IconCopy,
  IconDots,
  IconFileTypePdf,
  IconPrinter,
  IconBell,
  IconRobot,
  IconUser,
  IconUsers,
  IconSignature,
  IconInfoCircle
} from '@tabler/icons-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agreementsApi, Agreement, AgreementSignature } from '@/api/agreements.api';
import { useReactToPrint } from 'react-to-print';
import DocumentEditor from '@/components/DocumentEditor';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import SignaturesModal from './components/SignaturesModal';
import AIAgreementEditor from './components/AIAgreementEditor';

const AgreementDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [scroll] = useWindowScroll();
  const [searchParams] = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('document');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedStructure, setEditedStructure] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailsDrawerVisible, setDetailsDrawerVisible] = useState(false);
  const [signaturesModalVisible, setSignaturesModalVisible] = useState(false);
  const [aiEditorVisible, setAiEditorVisible] = useState(false);
  const [signatureDetailsModal, setSignatureDetailsModal] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<AgreementSignature | null>(null);
  const [viewMode, setViewMode] = useState<'formatted' | 'simple'>('formatted');
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('desktop');

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setDeviceType(mobile ? 'mobile' : 'desktop');
      if (mobile && !isEditing) {
        setViewMode('simple');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [isEditing]);

  useEffect(() => {
    if (id) {
      fetchAgreement();
    }
  }, [id]);

  useEffect(() => {
    const editParam = searchParams.get('edit');

    if (editParam === 'true') {
      setIsEditing(true);
      setActiveTab('document');
    }
  }, [searchParams]);

  const handleNotifyAgent = async () => {
    if (!agreement || !agreement.request_uuid) {
      notifications.show({
        title: t('errors.generic'),
        message: t('agreementDetail.errors.cannotNotify'),
        color: 'red',
        icon: <IconX size={18} />
      });
      return;
    }

    try {
      await agreementsApi.notifyAgent(agreement.id, agreement.request_uuid);
      notifications.show({
        title: t('common.success'),
        message: t('agreementDetail.success.agentNotified'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('agreementDetail.errors.notificationFailed'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const fetchAgreement = async () => {
    setLoading(true);
    try {
      const response = await agreementsApi.getById(Number(id));
      setAgreement(response.data.data);
      setEditedContent(response.data.data.content || '');
      setEditedStructure(response.data.data.structure || '');
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('agreementDetail.errors.loadFailed'),
        color: 'red',
        icon: <IconX size={18} />
      });
      navigate('/agreements');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    modals.openConfirmModal({
      title: t('agreementDetail.confirm.deleteTitle'),
      children: (
        <Text size="sm">
          {t('agreementDetail.confirm.deleteContent')}
        </Text>
      ),
      labels: {
        confirm: t('common.delete'),
        cancel: t('common.cancel')
      },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await agreementsApi.delete(Number(id));
          notifications.show({
            title: t('common.success'),
            message: t('agreementDetail.success.deleted'),
            color: 'green',
            icon: <IconCheck size={18} />
          });
          navigate('/agreements');
        } catch (error: any) {
          notifications.show({
            title: t('errors.generic'),
            message: error.response?.data?.message || t('agreementDetail.errors.deleteFailed'),
            color: 'red',
            icon: <IconX size={18} />
          });
        }
      }
    });
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: agreement?.agreement_number || 'agreement'
  });

  const copyPublicLink = () => {
    if (agreement) {
      navigator.clipboard.writeText(agreement.public_link);
      notifications.show({
        title: t('common.success'),
        message: t('agreementDetail.success.linkCopied'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    }
  };

  const handleDownloadPDF = async () => {
    if (!agreement) return;

    try {
      const response = await agreementsApi.downloadPDF(agreement.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${agreement.agreement_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      notifications.show({
        title: t('common.success'),
        message: t('agreementDetail.success.pdfDownloaded'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('agreementDetail.errors.pdfDownloadFailed'),
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  };

  const handleContentChange = (content: string, structure?: string) => {
    setEditedContent(content);
    if (structure) {
      setEditedStructure(structure);
    }
  };

  const handleSimpleContentChange = (content: string) => {
    setEditedContent(content);
    const newStructure = convertHtmlToStructure(content);
    setEditedStructure(newStructure);
  };

  const handleSaveEdit = async () => {
    if (!agreement) return;
    
    setSaving(true);
    try {
      await agreementsApi.update(agreement.id, {
        content: editedContent,
        structure: editedStructure
      });
      notifications.show({
        title: t('common.success'),
        message: t('agreementDetail.success.saved'),
        color: 'green',
        icon: <IconCheck size={18} />
      });
      setIsEditing(false);
      await fetchAgreement();
    } catch (error: any) {
      notifications.show({
        title: t('errors.generic'),
        message: error.response?.data?.message || t('agreementDetail.errors.saveFailed'),
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      setSaving(false);
    }
  };

  const convertHtmlToStructure = (html: string): string => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const structure: any = {
        title: 'LEASE AGREEMENT',
        city: 'Phuket',
        date: new Date().toISOString(),
        nodes: []
      };

      const h1 = doc.querySelector('h1');
      if (h1) {
        structure.title = h1.textContent?.trim() || 'LEASE AGREEMENT';
      }

      let sectionCounter = 1;
      let currentSection: any = null;
      const bodyChildren = Array.from(doc.body.children);

      bodyChildren.forEach((element) => {
        const tagName = element.tagName.toLowerCase();
        const content = element.textContent?.trim() || '';

        if (tagName === 'h1') return;

        if (tagName === 'h2') {
          if (currentSection) {
            structure.nodes.push(currentSection);
          }
          currentSection = {
            id: `section-${Date.now()}-${sectionCounter}`,
            type: 'section',
            content: content,
            number: sectionCounter.toString(),
            children: []
          };
          sectionCounter++;
        } else if ((tagName === 'h3' || tagName === 'p') && currentSection) {
          if (tagName === 'h3') {
            const subsectionNum = currentSection.children.filter((c: any) => c.type === 'subsection').length + 1;
            currentSection.children.push({
              id: `subsection-${Date.now()}-${Math.random()}`,
              type: 'subsection',
              content: content.replace(/^\d+(\.\d+)*\.\s*/, ''),
              number: `${currentSection.number}.${subsectionNum}`,
              level: 1
            });
          } else if (content) {
            currentSection.children.push({
              id: `paragraph-${Date.now()}-${Math.random()}`,
              type: 'paragraph',
              content: content
            });
          }
        } else if (tagName === 'ul' && currentSection) {
          const items: string[] = [];
          element.querySelectorAll('li').forEach((li) => {
            const itemText = li.textContent?.trim();
            if (itemText) items.push(itemText);
          });
          if (items.length > 0) {
            currentSection.children.push({
              id: `bulletlist-${Date.now()}-${Math.random()}`,
              type: 'bulletList',
              items: items
            });
          }
        }
      });

      if (currentSection) {
        structure.nodes.push(currentSection);
      }

      if (structure.nodes.length === 0) {
        const plainText = doc.body.textContent?.trim() || '';
        if (plainText) {
          structure.nodes = [{
            id: `section-${Date.now()}`,
            type: 'section',
            content: 'DOCUMENT CONTENT',
            number: '1',
            children: [{
              id: `paragraph-${Date.now()}`,
              type: 'paragraph',
              content: plainText
            }]
          }];
        }
      }

      return JSON.stringify(structure);
    } catch (error) {
      console.error('Error converting HTML to structure:', error);
      return JSON.stringify({
        title: 'LEASE AGREEMENT',
        city: 'Phuket',
        date: new Date().toISOString(),
        nodes: [{
          id: `section-${Date.now()}`,
          type: 'section',
          content: 'CONTENT',
          number: '1',
          children: []
        }]
      });
    }
  };

  const handleCancelEdit = () => {
    modals.openConfirmModal({
      title: t('agreementDetail.confirm.cancelEditTitle'),
      children: (
        <Text size="sm">
          {t('agreementDetail.confirm.cancelEditContent')}
        </Text>
      ),
      labels: {
        confirm: t('agreementDetail.confirm.cancelEditOk'),
        cancel: t('agreementDetail.confirm.cancelEditCancel')
      },
      onConfirm: () => {
        setIsEditing(false);
        setEditedContent(agreement?.content || '');
        setEditedStructure(agreement?.structure || '');
      }
    });
  };

  const handleAiEditorClose = () => {
    setAiEditorVisible(false);
  };

  const handleAiChangesApplied = async () => {
    setAiEditorVisible(false);
    setIsEditing(false);
    await fetchAgreement();
    notifications.show({
      title: t('common.success'),
      message: t('aiAgreementEditor.success.complete'),
      color: 'green',
      icon: <IconCheck size={18} />
    });
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'formatted' ? 'simple' : 'formatted');
    notifications.show({
      message: viewMode === 'formatted' 
        ? t('agreementDetail.viewModes.simple') 
        : t('agreementDetail.viewModes.formatted'),
      color: 'blue',
      icon: <IconInfoCircle size={18} />
    });
  };

  const handleSignatureDetailsClick = (record: AgreementSignature) => {
    if (isMobile) {
      setSelectedSignature(record);
      setSignatureDetailsModal(true);
    }
  };

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link'],
      ['clean']
    ]
  };

  if (loading) {
    return (
      <Center h="calc(100vh - 100px)">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            {t('common.loading')}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (!agreement) {
    return null;
  }

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      draft: { color: 'gray', text: t('agreementDetail.statuses.draft') },
      pending_signatures: { color: 'blue', text: t('agreementDetail.statuses.pendingSignatures') },
      signed: { color: 'green', text: t('agreementDetail.statuses.signed') },
      active: { color: 'teal', text: t('agreementDetail.statuses.active') },
      expired: { color: 'yellow', text: t('agreementDetail.statuses.expired') },
      cancelled: { color: 'red', text: t('agreementDetail.statuses.cancelled') }
    };
    
    const config = statusConfig[status] || { color: 'gray', text: status };
    return <Badge color={config.color} variant="light">{config.text}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      rent: t('agreementDetail.types.rent'),
      sale: t('agreementDetail.types.sale'),
      bilateral: t('agreementDetail.types.bilateral'),
      trilateral: t('agreementDetail.types.trilateral'),
      agency: t('agreementDetail.types.agency'),
      transfer_act: t('agreementDetail.types.transferAct')
    };
    return types[type] || type;
  };

  const signedCount = agreement.signatures?.filter(s => s.is_signed).length || 0;
  const totalCount = agreement.signatures?.length || 0;
  const signatureProgress = totalCount > 0 ? (signedCount / totalCount) * 100 : 0;

  const SignatureDetailsContent = ({ record }: { record: AgreementSignature }) => (
    <Stack gap="md">
      <Title order={5}>{t('agreementDetail.signatureDetails.title')}</Title>
      
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                {t('agreementDetail.signatureDetails.sessionInfo')}
              </Text>
              <Divider />
              <div>
                <Text size="xs" c="dimmed">
                  {t('agreementDetail.signatureDetails.ipAddress')}:
                </Text>
                <Text size="sm" fw={500}>
                  {record.ip_address || t('agreementDetail.signatureDetails.notDetermined')}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  {t('agreementDetail.signatureDetails.device')}:
                </Text>
                <Text size="sm" fw={500}>
                  {record.device_type || t('agreementDetail.signatureDetails.notDetermined')}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  {t('agreementDetail.signatureDetails.browser')}:
                </Text>
                <Text size="sm" fw={500}>
                  {record.browser || t('agreementDetail.signatureDetails.notDetermined')}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  {t('agreementDetail.signatureDetails.os')}:
                </Text>
                <Text size="sm" fw={500}>
                  {record.os || t('agreementDetail.signatureDetails.notDetermined')}
                </Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                {t('agreementDetail.signatureDetails.timeMetrics')}
              </Text>
              <Divider />
              <div>
                <Text size="xs" c="dimmed">
                  {t('agreementDetail.signatureDetails.firstVisit')}:
                </Text>
                <Text size="sm" fw={500}>
                  {record.first_visit_at 
                    ? new Date(record.first_visit_at).toLocaleString('ru-RU')
                    : t('agreementDetail.signatureDetails.notVisited')}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  {t('agreementDetail.signatureDetails.viewDuration')}:
                </Text>
                <Text size="sm" fw={500}>
                  {record.agreement_view_duration 
                    ? t('agreementDetail.signatureDetails.timeFormat', {
                        minutes: Math.floor(record.agreement_view_duration / 60),
                        seconds: record.agreement_view_duration % 60
                      })
                    : '0 ' + t('agreementDetail.signatureDetails.seconds')}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  {t('agreementDetail.signatureDetails.totalDuration')}:
                </Text>
                <Text size="sm" fw={500}>
                  {record.total_session_duration 
                    ? t('agreementDetail.signatureDetails.timeFormat', {
                        minutes: Math.floor(record.total_session_duration / 60),
                        seconds: record.total_session_duration % 60
                      })
                    : '0 ' + t('agreementDetail.signatureDetails.seconds')}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  {t('agreementDetail.signatureDetails.clearCount')}:
                </Text>
                <Text size="sm" fw={500}>
                  {record.signature_clear_count || 0}
                </Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        {record.is_signed && record.signature_data && (
          <Grid.Col span={12}>
            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {t('agreementDetail.signatureDetails.signature')}
                </Text>
                <Divider />
                <Center>
                  <img 
                    src={record.signature_data} 
                    alt="Signature" 
                    style={{ 
                      maxWidth: '300px', 
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      padding: '8px',
                      background: 'white'
                    }} 
                  />
                </Center>
              </Stack>
            </Card>
          </Grid.Col>
        )}

        {record.signature_link && (
          <Grid.Col span={12}>
            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {t('agreementDetail.signatureDetails.signatureLink')}
                </Text>
                <Divider />
                <Group gap="xs">
                  <TextInput
                    value={`https://agreement.novaestate.company/sign/${record.signature_link}`}
                    readOnly
                    style={{ flex: 1 }}
                    styles={{
                      input: { fontSize: '16px' }
                    }}
                  />
                  <CopyButton value={`https://agreement.novaestate.company/sign/${record.signature_link}`}>
                    {({ copied, copy }) => (
                      <Button
                        color={copied ? 'teal' : 'blue'}
                        onClick={copy}
                        leftSection={<IconCopy size={16} />}
                      >
                        {copied ? t('common.copied') : t('agreementDetail.actions.copy')}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
        )}
      </Grid>
    </Stack>
  );

  return (
    <Stack gap="lg" p={isMobile ? 'sm' : 'md'}>
      {!isMobile && (
        <Affix position={{ top: 0, left: 0, right: 0 }} zIndex={100}>
          <Transition transition="slide-down" mounted={scroll.y > 100}>
            {(styles) => (
              <Paper
                shadow="md"
                p="md"
                style={{
                  ...styles,
                  borderRadius: 0,
                  borderBottom: `1px solid ${theme.colors.dark[4]}`
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => navigate('/agreements')}
                      size="lg"
                    >
                      <IconArrowLeft size={20} />
                    </ActionIcon>
                    <Text fw={600} size="sm" lineClamp={1}>
                      {agreement.agreement_number}
                    </Text>
                    {getStatusTag(agreement.status)}
                  </Group>
                  <Group gap="xs">
                    {!isEditing ? (
                      <>
                        <ActionIcon
                          variant="light"
                          color="blue"
                          onClick={() => setIsEditing(true)}
                        >
                          <IconEdit size={18} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={copyPublicLink}
                        >
                          <IconLink size={18} />
                        </ActionIcon>
                      </>
                    ) : (
                      <>
                        <ActionIcon
                          variant="filled"
                          color="green"
                          onClick={handleSaveEdit}
                          loading={saving}
                        >
                          <IconDeviceFloppy size={18} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="gray"
                          onClick={handleCancelEdit}
                        >
                          <IconX size={18} />
                        </ActionIcon>
                      </>
                    )}
                  </Group>
                </Group>
              </Paper>
            )}
          </Transition>
        </Affix>
      )}

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <Group gap="md">
              <ActionIcon
                variant="subtle"
                size="xl"
                onClick={() => navigate('/agreements')}
              >
                <IconArrowLeft size={24} />
              </ActionIcon>
              <div>
                <Title order={isMobile ? 4 : 3}>
                  {t('agreementDetail.title', { number: agreement.agreement_number })}
                </Title>
                <Group gap="xs" mt={4}>
                  {getStatusTag(agreement.status)}
                  <Badge variant="outline">{getTypeLabel(agreement.type)}</Badge>
                </Group>
              </div>
            </Group>

            {!isMobile && (
              <Group gap="xs">
                {!isEditing ? (
                  <>
                    <Button
                      variant="light"
                      leftSection={<IconEdit size={18} />}
                      onClick={() => setIsEditing(true)}
                      size="sm"
                    >
                      {t('agreementDetail.actions.edit')}
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<IconFileTypePdf size={18} />}
                      onClick={handleDownloadPDF}
                      size="sm"
                    >
                      PDF
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<IconPrinter size={18} />}
                      onClick={handlePrint}
                      size="sm"
                    >
                      {t('agreementDetail.actions.print')}
                    </Button>
                    <CopyButton value={agreement.public_link}>
                      {({ copied, copy }) => (
                        <Button
                          variant="light"
                          color={copied ? 'teal' : 'blue'}
                          leftSection={<IconLink size={18} />}
                          onClick={copy}
                          size="sm"
                        >
                          {copied ? t('common.copied') : t('agreementDetail.actions.link')}
                        </Button>
                      )}
                    </CopyButton>
                    {agreement.request_uuid && totalCount > 0 && (
                      <Button
                        variant="light"
                        color="green"
                        leftSection={<IconBell size={18} />}
                        onClick={handleNotifyAgent}
                        size="sm"
                      >
                        {t('agreementDetail.actions.notifyAgent')}
                      </Button>
                    )}
                    <Menu position="bottom-end" shadow="md">
                      <Menu.Target>
                        <ActionIcon variant="light" size="lg">
                          <IconDots size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconTrash size={16} />}
                          color="red"
                          onClick={handleDelete}
                        >
                          {t('common.delete')}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </>
                ) : (
                  <>
                    <Button
                      leftSection={<IconDeviceFloppy size={18} />}
                      onClick={handleSaveEdit}
                      loading={saving}
                      size="sm"
                    >
                      {t('common.save')}
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<IconX size={18} />}
                      onClick={handleCancelEdit}
                      size="sm"
                    >
                      {t('common.cancel')}
                    </Button>
                  </>
                )}
              </Group>
            )}
          </Group>

          {isMobile && (
            <Paper p="sm" radius="md" withBorder>
              {!isEditing ? (
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      size="lg"
                      onClick={() => setIsEditing(true)}
                    >
                      <IconEdit size={20} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      size="lg"
                      onClick={handleDownloadPDF}
                    >
                      <IconFileTypePdf size={20} />
                    </ActionIcon>
                    <CopyButton value={agreement.public_link}>
                      {({ copied, copy }) => (
                        <ActionIcon
                          variant="light"
                          color={copied ? 'teal' : 'blue'}
                          size="lg"
                          onClick={copy}
                        >
                          <IconLink size={20} />
                        </ActionIcon>
                      )}
                    </CopyButton>
                    <ActionIcon
                      variant="light"
                      color="gray"
                      size="lg"
                      onClick={handlePrint}
                    >
                      <IconPrinter size={20} />
                    </ActionIcon>
                  </Group>
                  <Menu position="bottom-end" shadow="md">
                    <Menu.Target>
                      <ActionIcon variant="light" color="gray" size="lg">
                        <IconDots size={20} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {agreement.request_uuid && totalCount > 0 && (
                        <>
                          <Menu.Item
                            leftSection={<IconBell size={16} />}
                            onClick={handleNotifyAgent}
                          >
                            {t('agreementDetail.actions.notifyAgent')}
                          </Menu.Item>
                          <Menu.Divider />
                        </>
                      )}
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={16} />}
                        onClick={handleDelete}
                      >
                        {t('common.delete')}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              ) : (
                <Group justify="center" gap="md">
                  <Button
                    leftSection={<IconDeviceFloppy size={18} />}
                    onClick={handleSaveEdit}
                    loading={saving}
                    size="sm"
                    style={{ flex: 1 }}
                  >
                    {t('common.save')}
                  </Button>
                  <Button
                    variant="light"
                    leftSection={<IconX size={18} />}
                    onClick={handleCancelEdit}
                    size="sm"
                    style={{ flex: 1 }}
                  >
                    {t('common.cancel')}
                  </Button>
                </Group>
              )}
            </Paper>
          )}

          {totalCount > 0 && (
            <Card shadow="xs" padding="md" radius="md" withBorder>
              <Group justify="space-between" wrap="wrap">
                <Group gap="md">
                  <RingProgress
                    size={60}
                    thickness={6}
                    sections={[
                      { value: signatureProgress, color: signatureProgress === 100 ? 'green' : 'blue' }
                    ]}
                    label={
                      <Center>
                        <Text size="xs" fw={700}>
                          {signedCount}/{totalCount}
                        </Text>
                      </Center>
                    }
                  />
                  <div>
                    <Text size="sm" fw={600}>
                      {t('agreementDetail.fields.signatures')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {signedCount === totalCount 
                        ? t('agreementDetail.allSigned')
                        : t('agreementDetail.waitingForSignatures')}
                    </Text>
                  </div>
                </Group>
                <Button
                  variant="light"
                  size="xs"
                  onClick={() => setActiveTab('signatures')}
                  rightSection={<IconSignature size={14} />}
                >
                  {t('agreementDetail.viewSignatures')}
                </Button>
              </Group>
            </Card>
          )}
        </Stack>
      </Card>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List grow={isMobile}>
          <Tabs.Tab
            value="document"
            leftSection={<IconFileText size={18} />}
          >
            {t('agreementDetail.tabs.document')}
          </Tabs.Tab>
          <Tabs.Tab
            value="details"
            leftSection={<IconInfoCircle size={18} />}
          >
            {t('agreementDetail.tabs.details')}
          </Tabs.Tab>
          <Tabs.Tab
            value="parties"
            leftSection={<IconUsers size={18} />}
          >
            {t('agreementDetail.tabs.parties')}
          </Tabs.Tab>
          <Tabs.Tab
            value="signatures"
            leftSection={<IconSignature size={18} />}
          >
            {t('agreementDetail.tabs.signatures')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="document" pt="xl">
          <Stack gap="md">
            {isEditing && (
              <Button
                size="lg"
                fullWidth
                leftSection={<IconRobot size={20} />}
                onClick={() => setAiEditorVisible(true)}
                color="green"
                variant="gradient"
                gradient={{ from: 'teal', to: 'lime' }}
              >
                {t('aiAgreementEditor.button')}
              </Button>
            )}

            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  {deviceType === 'mobile' ? <IconDeviceMobile size={18} /> : <IconDeviceDesktop size={18} />}
                  <Text size="xs" c="dimmed">
                    {deviceType === 'mobile' 
                      ? t('agreementDetail.deviceTypes.mobile') 
                      : t('agreementDetail.deviceTypes.desktop')}
                  </Text>
                </Group>

                <Group gap="xs">
                  <Text size="xs" c="dimmed">
                    {viewMode === 'formatted' 
                      ? t('agreementDetail.viewModes.formatted') 
                      : t('agreementDetail.viewModes.simple')}
                  </Text>
                  <Switch
                    checked={viewMode === 'formatted'}
                    onChange={toggleViewMode}
                    onLabel={<IconFileText size={12} />}
                    offLabel={<IconCode size={12} />}
                  />
                </Group>
              </Group>

              <div style={{ display: 'none' }}>
                <div ref={printRef}>
                  <DocumentEditor
                    agreement={agreement}
                    isEditing={false}
                    logoUrl="/nova-logo.svg"
                  />
                </div>
              </div>

              {isEditing ? (
                viewMode === 'formatted' ? (
                  <DocumentEditor
                    agreement={agreement}
                    isEditing={true}
                    onContentChange={handleContentChange}
                    logoUrl="/nova-logo.svg"
                  />
                ) : (
                  <Box style={{ minHeight: 600 }}>
                    <ReactQuill
                      value={editedContent}
                      onChange={handleSimpleContentChange}
                      modules={modules}
                      theme="snow"
                      style={{ height: '600px', marginBottom: '50px' }}
                    />
                  </Box>
                )
              ) : (
                viewMode === 'formatted' ? (
                  <Box style={deviceType === 'mobile' ? { 
                    transform: 'scale(0.7)', 
                    transformOrigin: 'top left',
                    width: '142.85%',
                    marginBottom: '-100px'
                  } : {}}>
                    <DocumentEditor
                      agreement={agreement}
                      isEditing={false}
                      logoUrl="/nova-logo.svg"
                    />
                  </Box>
                ) : (
                  <Box>
                    <ReactQuill
                      value={agreement.content}
                      readOnly={true}
                      theme="snow"
                      modules={{ toolbar: false }}
                      style={{ minHeight: 400 }}
                    />
                  </Box>
                )
              )}
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="details" pt="xl">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {t('agreementDetail.fields.agreementNumber')}
                  </Text>
                  <Text size="sm" fw={600}>
                    {agreement.agreement_number}
                  </Text>
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {t('agreementDetail.fields.type')}
                  </Text>
                  <Text size="sm" fw={600}>
                    {getTypeLabel(agreement.type)}
                  </Text>
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {t('agreementDetail.fields.status')}
                  </Text>
                  <div>
                    {getStatusTag(agreement.status)}
                  </div>
                </Stack>
              </Grid.Col>
              {agreement.property_name && (
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      {t('agreementDetail.fields.property')}
                    </Text>
                    <Text size="sm" fw={600}>
                      {agreement.property_name} ({agreement.property_number})
                    </Text>
                  </Stack>
                </Grid.Col>
              )}
              {agreement.description && (
                <Grid.Col span={12}>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      {t('agreementDetail.fields.description')}
                    </Text>
                    <Text size="sm">
                      {agreement.description}
                    </Text>
                  </Stack>
                </Grid.Col>
              )}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {t('agreementDetail.fields.city')}
                  </Text>
                  <Text size="sm" fw={600}>
                    {agreement.city}
                  </Text>
                </Stack>
              </Grid.Col>
              {agreement.date_from && (
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      {t('agreementDetail.fields.dateFrom')}
                    </Text>
                    <Text size="sm" fw={600}>
                      {new Date(agreement.date_from).toLocaleDateString('ru-RU')}
                    </Text>
                  </Stack>
                </Grid.Col>
              )}
              {agreement.date_to && (
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      {t('agreementDetail.fields.dateTo')}
                    </Text>
                    <Text size="sm" fw={600}>
                      {new Date(agreement.date_to).toLocaleDateString('ru-RU')}
                    </Text>
                  </Stack>
                </Grid.Col>
              )}
              {agreement.rent_amount_monthly && (
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      {t('agreementDetail.fields.rentMonthly')}
                    </Text>
                    <Text size="sm" fw={600}>
                      {agreement.rent_amount_monthly.toLocaleString('ru-RU')} ₿
                    </Text>
                  </Stack>
                </Grid.Col>
              )}
              {agreement.deposit_amount && (
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      {t('agreementDetail.fields.deposit')}
                    </Text>
                    <Text size="sm" fw={600}>
                      {agreement.deposit_amount.toLocaleString('ru-RU')} ₿
                    </Text>
                  </Stack>
                </Grid.Col>
              )}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {t('agreementDetail.fields.created')}
                  </Text>
                  <Text size="sm" fw={600}>
                    {new Date(agreement.created_at).toLocaleDateString('ru-RU')}
                  </Text>
                </Stack>
              </Grid.Col>
              {agreement.created_by_name && (
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      {t('agreementDetail.fields.author')}
                    </Text>
                    <Text size="sm" fw={600}>
                      {agreement.created_by_name}
                    </Text>
                  </Stack>
                </Grid.Col>
              )}
            </Grid>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="parties" pt="xl">
          {agreement.parties && agreement.parties.length > 0 ? (
            <Grid gutter="md">
              {agreement.parties.map((party, index) => (
                <Grid.Col key={index} span={{ base: 12, md: 6 }}>
                  <Card
                    shadow="sm"
                    padding="md"
                    radius="md"
                    withBorder
                    style={{
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = theme.shadows.md;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = theme.shadows.sm;
                    }}
                  >
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Badge color="blue" variant="light">
                          {party.role}
                        </Badge>
                      </Group>
                      <div>
                        <Text fw={600}>{party.name}</Text>
                      </div>
                      <Divider />
                      <Stack gap={4}>
                        <Group gap="xs">
                          <Text size="xs" c="dimmed">
                            {t('agreementDetail.fields.country')}:
                          </Text>
                          <Text size="xs" fw={500}>
                            {party.passport_country}
                          </Text>
                        </Group>
                        <Group gap="xs">
                          <Text size="xs" c="dimmed">
                            {t('agreementDetail.fields.passport')}:
                          </Text>
                          <Text size="xs" fw={500}>
                            {party.passport_number}
                          </Text>
                        </Group>
                      </Stack>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          ) : (
            <Paper shadow="sm" p="xl" radius="md" withBorder>
              <Center>
                <Stack align="center" gap="md">
                  <IconUser size={48} color={theme.colors.gray[5]} />
                  <Text size="lg" c="dimmed">
                    {t('agreementDetail.messages.noParties')}
                  </Text>
                </Stack>
              </Center>
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="signatures" pt="xl">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="lg">
              <Group justify="space-between" wrap="wrap">
                <Button
                  leftSection={<IconEdit size={18} />}
                  onClick={() => setSignaturesModalVisible(true)}
                  disabled={!agreement.parties || agreement.parties.length === 0}
                  size={isMobile ? 'xs' : 'sm'}
                >
                  {totalCount > 0 
                    ? t('agreementDetail.actions.manageSignatures') 
                    : t('agreementDetail.actions.sendForSignature')}
                </Button>
                {totalCount > 0 && (
                  <Progress
                    value={signatureProgress}
                    w={isMobile ? '100%' : 200}
                    color={signatureProgress === 100 ? 'green' : 'blue'}
                    animated={signatureProgress < 100}
                  />
                )}
              </Group>

              {totalCount > 0 ? (
                <Stack gap="md">
                  {isMobile ? (
                    agreement.signatures?.map((signature) => (
                      <Card
                        key={signature.id}
                        shadow="xs"
                        padding="sm"
                        radius="md"
                        withBorder
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSignatureDetailsClick(signature)}
                      >
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <div>
                              <Text size="sm" fw={600}>
                                {signature.signer_name}
                              </Text>
                              <Badge size="xs" color="blue" variant="light" mt={4}>
                                {signature.signer_role}
                              </Badge>
                            </div>
                            <Badge
                              color={signature.is_signed ? 'green' : 'gray'}
                              variant="light"
                              leftSection={signature.is_signed ? <IconCheck size={12} /> : undefined}
                            >
                              {signature.is_signed 
                                ? t('agreementDetail.statuses.signed') 
                                : t('agreementDetail.statuses.waiting')}
                            </Badge>
                          </Group>
                          {signature.is_signed && signature.signed_at && (
                            <Text size="xs" c="dimmed">
                              {new Date(signature.signed_at).toLocaleDateString('ru-RU')}
                            </Text>
                          )}
                        </Stack>
                      </Card>
                    ))
                  ) : (
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('agreementDetail.table.signer')}</Table.Th>
                          <Table.Th>{t('agreementDetail.table.status')}</Table.Th>
                          <Table.Th>{t('agreementDetail.table.device')}</Table.Th>
                          <Table.Th>{t('agreementDetail.table.ipAddress')}</Table.Th>
                          <Table.Th>{t('agreementDetail.table.viewTime')}</Table.Th>
                          <Table.Th>{t('agreementDetail.table.actions')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {agreement.signatures?.map((signature) => (
                          <>
                            <Table.Tr key={signature.id}>
                              <Table.Td>
                                <Stack gap={4}>
                                  <Text size="sm" fw={600}>
                                    {signature.signer_name}
                                  </Text>
                                  <Badge size="xs" color="blue" variant="light">
                                    {signature.signer_role}
                                  </Badge>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  <Badge
                                    color={signature.is_signed ? 'green' : 'gray'}
                                    variant="light"
                                    leftSection={signature.is_signed ? <IconCheck size={12} /> : undefined}
                                  >
                                    {signature.is_signed 
                                      ? t('agreementDetail.statuses.signed') 
                                      : t('agreementDetail.statuses.waiting')}
                                  </Badge>
                                  {signature.is_signed && signature.signed_at && (
                                    <Text size="xs" c="dimmed">
                                      {new Date(signature.signed_at).toLocaleDateString('ru-RU')}
                                    </Text>
                                  )}
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {signature.device_type || '—'}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {signature.ip_address || '—'}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {signature.agreement_view_duration 
                                    ? t('agreementDetail.signatureDetails.timeFormat', {
                                        minutes: Math.floor(signature.agreement_view_duration / 60),
                                        seconds: signature.agreement_view_duration % 60
                                      })
                                    : '—'}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Menu position="bottom-end" shadow="md">
                                  <Menu.Target>
                                    <ActionIcon variant="subtle" size="sm">
                                      <IconDots size={16} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown>
                                    {signature.signature_link && !signature.is_signed && (
                                      <>
                                        <Menu.Item
                                          leftSection={<IconCopy size={16} />}
                                          onClick={() => {
                                            navigator.clipboard.writeText(
                                              `https://agreement.novaestate.company/sign/${signature.signature_link}`
                                            );
                                            notifications.show({
                                              title: t('common.success'),
                                              message: t('agreementDetail.success.linkCopied'),
                                              color: 'green',
                                              icon: <IconCheck size={18} />
                                            });
                                          }}
                                        >
                                          {t('agreementDetail.actions.copyLink')}
                                        </Menu.Item>
                                        <Menu.Item
                                          leftSection={<IconRefresh size={16} />}
                                          onClick={async () => {
                                            try {
                                              const response = await agreementsApi.regenerateSignatureLink(signature.id);
                                              notifications.show({
                                                title: t('common.success'),
                                                message: t('agreementDetail.success.linkRegenerated'),
                                                color: 'green',
                                                icon: <IconCheck size={18} />
                                              });
                                              navigator.clipboard.writeText(response.data.data.public_url);
                                              fetchAgreement();
                                            } catch (error: any) {
                                              notifications.show({
                                                title: t('errors.generic'),
                                                message: t('agreementDetail.errors.regenerateFailed'),
                                                color: 'red',
                                                icon: <IconX size={18} />
                                              });
                                            }
                                          }}
                                        >
                                          {t('agreementDetail.actions.regenerateLink')}
                                        </Menu.Item>
                                      </>
                                    )}
                                    <Menu.Divider />
                                    <Menu.Item
                                      color="red"
                                      leftSection={<IconTrash size={16} />}
                                      onClick={() => {
                                        modals.openConfirmModal({
                                          title: t('agreementDetail.confirm.deleteSignatureTitle'),
                                          children: (
                                            <Text size="sm">
                                              {t('agreementDetail.confirm.deleteContent')}
                                            </Text>
                                          ),
                                          labels: {
                                            confirm: t('common.delete'),
                                            cancel: t('common.cancel')
                                          },
                                          confirmProps: { color: 'red' },
                                          onConfirm: async () => {
                                            try {
                                              await agreementsApi.deleteSignature(signature.id);
                                              notifications.show({
                                                title: t('common.success'),
                                                message: t('agreementDetail.success.signatureDeleted'),
                                                color: 'green',
                                                icon: <IconCheck size={18} />
                                              });
                                              fetchAgreement();
                                            } catch (error: any) {
                                              notifications.show({
                                                title: t('errors.generic'),
                                                message: t('agreementDetail.errors.deleteFailed'),
                                                color: 'red',
                                                icon: <IconX size={18} />
                                              });
                                            }
                                          }
                                        });
                                      }}
                                    >
                                      {t('common.delete')}
                                    </Menu.Item>
                                  </Menu.Dropdown>
                                </Menu>
                              </Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                              <Table.Td colSpan={6} style={{ padding: 0 }}>
                                <Box p="md" style={{ background: theme.colors.dark[7] }}>
                                  <SignatureDetailsContent record={signature} />
                                </Box>
                              </Table.Td>
                            </Table.Tr>
                          </>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Stack>
              ) : (
                <Paper shadow="sm" p="xl" radius="md" withBorder>
                  <Center>
                    <Stack align="center" gap="md">
                      <IconFileText size={48} color={theme.colors.gray[5]} />
                      <Text size="lg" c="dimmed">
                        {t('agreementDetail.messages.noSignatures')}
                      </Text>
                      <Text size="sm" c="dimmed" ta="center">
                        {t('agreementDetail.messages.noSignaturesHint')}
                      </Text>
                    </Stack>
                  </Center>
                </Paper>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Drawer
        opened={detailsDrawerVisible}
        onClose={() => setDetailsDrawerVisible(false)}
        title={t('agreementDetail.drawer.title')}
        position="bottom"
        size="80%"
      >
        <Stack gap="md">
          {/* Аналогично табу details */}
        </Stack>
      </Drawer>

      <Drawer
        opened={signatureDetailsModal}
        onClose={() => {
          setSignatureDetailsModal(false);
          setSelectedSignature(null);
        }}
        title={t('agreementDetail.signatureDetails.title')}
        position="bottom"
        size="90%"
      >
        {selectedSignature && (
          <SignatureDetailsContent record={selectedSignature} />
        )}
      </Drawer>

      <SignaturesModal
        visible={signaturesModalVisible}
        onCancel={() => setSignaturesModalVisible(false)}
        onSuccess={() => {
          fetchAgreement();
          setSignaturesModalVisible(false);
        }}
        agreementId={agreement.id}
        parties={agreement.parties || []}
        existingSignatures={agreement.signatures}
        requestUuid={agreement.request_uuid}
      />

      <Drawer
        opened={aiEditorVisible}
        onClose={handleAiEditorClose}
        position="right"
        size="90%"
        padding={0}
        withCloseButton={false}
      >
        <AIAgreementEditor
          agreementId={agreement.id}
          onChangesApplied={handleAiChangesApplied}
          onClose={handleAiEditorClose}
        />
      </Drawer>
    </Stack>
  );
};

export default AgreementDetail;