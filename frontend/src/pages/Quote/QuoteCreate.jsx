import useLanguage from '@/locale/useLanguage';
import CreateQuoteModule from '@/modules/QuoteModule/CreateQuoteModule';

export default function QuoteCreate() {
  const translate = useLanguage();
  const config = {
    entity: 'quote',
    PANEL_TITLE: translate('quote'),
    DATATABLE_TITLE: translate('quote_list'),
    ADD_NEW_ENTITY: translate('add_new_quote'),
    ENTITY_NAME: translate('quote'),
  };
  return <CreateQuoteModule config={config} />;
}
