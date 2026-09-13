import dayjs from 'dayjs';

// The ERP's version of this hook reads the tenant's preferred date format out of
// the settings redux slice. The Super Admin portal owns no tenant settings, so it
// uses a fixed format rather than pulling in a reducer it has no use for.
const DEFAULT_DATE_FORMAT = 'DD/MM/YYYY';

const formatDate = (value) => (value ? dayjs(value).format(DEFAULT_DATE_FORMAT) : '');

const useDate = () => ({
  dateFormat: DEFAULT_DATE_FORMAT,
  formatDate,
});

export default useDate;
