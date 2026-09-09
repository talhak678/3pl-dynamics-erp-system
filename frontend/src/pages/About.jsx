import { Button, Result } from 'antd';

import useLanguage from '@/locale/useLanguage';

const About = () => {
  const translate = useLanguage();
  return (
    <Result
      status="info"
      title={'3PL Dynamics'}
      subTitle={translate('Do you need help on customize of this app')}
      extra={
        <>
          <p>
            Website : <a href="https://www.3pldynamicsai.com">www.3pldynamicsai.com</a>{' '}
          </p>
          <Button
            type="primary"
            onClick={() => {
              window.open(`https://www.3pldynamicsai.com`);
            }}
          >
            {translate('Contact us')}
          </Button>
        </>
      }
    />
  );
};

export default About;
