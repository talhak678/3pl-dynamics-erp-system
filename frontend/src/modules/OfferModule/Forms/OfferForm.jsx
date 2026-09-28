import { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { Form, Input, InputNumber, Button, Select, Divider, Row, Col } from 'antd';

import { PlusOutlined } from '@ant-design/icons';

import { DatePicker } from 'antd';

import AutoCompleteAsync from '@/components/AutoCompleteAsync';
import AssigneeSelect from '@/components/AssigneeSelect';
import SelectAsync from '@/components/SelectAsync';

import ItemRow from '@/modules/ErpPanelModule/ItemRow';

import MoneyInputFormItem from '@/components/MoneyInputFormItem';

import calculate from '@/utils/calculate';
import { selectFinanceSettings } from '@/redux/settings/selectors';
import { useDate, useMoney } from '@/settings';
import { useSelector } from 'react-redux';
import useLanguage from '@/locale/useLanguage';
import SelectCurrency from '@/components/SelectCurrency';

export default function OfferForm({ subTotal = 0, current = null }) {
  const { last_offer_number } = useSelector(selectFinanceSettings);

  if (last_offer_number === undefined) {
    return <></>;
  }

  return <LoadOfferForm subTotal={subTotal} current={current} />;
}

function LoadOfferForm({ subTotal = 0, current = null }) {
  const translate = useLanguage();
  const { dateFormat } = useDate();
  const { currency_symbol, currency_position, cent_precision } = useMoney();
  const { last_offer_number } = useSelector(selectFinanceSettings);
  const [lastNumber, setLastNumber] = useState(() => last_offer_number + 1);
  const [total, setTotal] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [taxTotal, setTaxTotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const handelTaxChange = (value) => {
    setTaxRate(value / 100);
  };
  /**
   * The discount on the offer, as money taken off the subtotal.
   *
   * Held in state as well as in the form because the totals below are worked out
   * from it as it is typed - the form field is what gets submitted, this is what
   * the running figures are computed from, the same split the tax rate above
   * already uses.
   *
   * An emptied input reports null, which is no discount rather than a missing
   * value; it is also written to the form as null, and the server reads that as
   * zero too.
   */
  const handelDiscountChange = (value) => {
    setDiscount(value || 0);
  };

  useEffect(() => {
    if (current) {
      const { taxRate = 0, year, number, discount = 0 } = current;
      setTaxRate(taxRate / 100);
      setDiscount(discount);
      setCurrentYear(year);
      setLastNumber(number);
    }
  }, [current]);
  useEffect(() => {
    // The same order of operations as the server, so the figures on screen are
    // the ones the saved offer will carry: the discount comes off the subtotal
    // and the tax is worked out on what is left. Clamped the same way too - the
    // server refuses a discount larger than the subtotal, and a preview showing
    // the resulting negative total would be promising a figure the saved record
    // would not keep. See offerController/create.js.
    const discountAmount = Math.min(Math.max(discount || 0, 0), subTotal);
    const payableSubTotal = calculate.sub(subTotal, discountAmount);

    setTaxTotal(calculate.multiply(payableSubTotal, taxRate));
    setTotal(calculate.add(calculate.multiply(payableSubTotal, taxRate), payableSubTotal));
  }, [subTotal, taxRate, discount]);

  const addField = useRef(false);

  useEffect(() => {
    addField.current.click();
  }, []);

  return (
    <>
      <Row gutter={[12, 0]}>
        <Col className="gutter-row" span={8}>
          <Form.Item
            name="lead"
            label={translate('Lead')}
            rules={[
              {
                required: true,
              },
            ]}
          >
            <AutoCompleteAsync
              entity={'lead'}
              displayLabels={['name']}
              searchFields={'name'}
              redirectLabel={'Add New Lead'}
              withRedirect
              urlToRedirect={'/lead'}
            />
          </Form.Item>
        </Col>
        <Col className="gutter-row" span={3}>
          <Form.Item
            label={translate('number')}
            name="number"
            initialValue={lastNumber}
            rules={[
              {
                required: true,
              },
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col className="gutter-row" span={3}>
          <Form.Item
            label={translate('year')}
            name="year"
            initialValue={currentYear}
            rules={[
              {
                required: true,
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col className="gutter-row" span={6}>
          <SelectCurrency />
        </Col>
        <Col className="gutter-row" span={4}>
          <Form.Item
            label={translate('status')}
            name="status"
            rules={[
              {
                required: false,
              },
            ]}
            initialValue={'draft'}
          >
            <Select
              options={[
                { value: 'draft', label: translate('Draft') },
                { value: 'pending', label: translate('Pending') },
                { value: 'sent', label: translate('Sent') },
                { value: 'accepted', label: translate('Accepted') },
                { value: 'declined', label: translate('Declined') },
              ]}
            ></Select>
          </Form.Item>
        </Col>

        <Col className="gutter-row" span={8}>
          <Form.Item
            name="date"
            label={translate('Date')}
            rules={[
              {
                required: true,
                type: 'object',
              },
            ]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} format={dateFormat} />
          </Form.Item>
        </Col>
        <Col className="gutter-row" span={6}>
          <Form.Item
            name="expiredDate"
            label={translate('Expire Date')}
            rules={[
              {
                required: true,
                type: 'object',
              },
            ]}
            initialValue={dayjs().add(30, 'days')}
          >
            <DatePicker style={{ width: '100%' }} format={dateFormat} />
          </Form.Item>
        </Col>
        <Col className="gutter-row" span={10}>
          <Form.Item label={translate('Note')} name="notes">
            <Input />
          </Form.Item>
        </Col>
      </Row>
      {/*
        Who inside the workspace owns this offer.

        Not one of the entities the brief named for an "Assign To" control, but
        Offer is one of the models a child account's read scope narrows, so
        without this the owner would have no way to hand an offer to anyone -
        the record would be reachable only by whoever typed it in. Lead, its
        sibling in the pipeline, already has the same control.

        AssigneeSelect brings its own Form.Item and renders nothing at all for an
        account that may not assign, so an owner gains a picker here and everyone
        else sees the form they had before. Given its own Row because the header
        above already fills a 24-column grid.
      */}
      <Row gutter={[12, 0]}>
        <Col className="gutter-row" span={8}>
          <AssigneeSelect />
        </Col>
      </Row>
      <Divider dashed />
      <Row gutter={[12, 12]} style={{ position: 'relative' }}>
        <Col className="gutter-row" span={5}>
          <p>{translate('Item')}</p>
        </Col>
        <Col className="gutter-row" span={7}>
          <p>{translate('Description')}</p>
        </Col>
        <Col className="gutter-row" span={3}>
          <p>{translate('Quantity')}</p>{' '}
        </Col>
        <Col className="gutter-row" span={4}>
          <p>{translate('Price')}</p>
        </Col>
        <Col className="gutter-row" span={5}>
          <p>{translate('Total')}</p>
        </Col>
      </Row>
      <Form.List name="items">
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <ItemRow key={field.key} remove={remove} field={field} current={current}></ItemRow>
            ))}
            <Form.Item>
              <Button
                type="dashed"
                onClick={() => add()}
                block
                icon={<PlusOutlined />}
                ref={addField}
              >
                {translate('Add field')}
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
      <Divider dashed />
      <div style={{ position: 'relative', width: ' 100%', float: 'right' }}>
        <Row gutter={[12, -5]}>
          <Col className="gutter-row" span={5}>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>
                {translate('Save')}
              </Button>
            </Form.Item>
          </Col>
          <Col className="gutter-row" span={4} offset={10}>
            <p
              style={{
                paddingLeft: '12px',
                paddingTop: '5px',
                margin: 0,
                textAlign: 'right',
              }}
            >
              {translate('Sub Total')} :
            </p>
          </Col>
          <Col className="gutter-row" span={5}>
            <MoneyInputFormItem readOnly value={subTotal} />
          </Col>
        </Row>
        {/*
          The discount, and the only editable figure in this column.

          Bound to the form by name so it is submitted with the rest of the
          fields, which is what makes it a real reduction rather than a number
          the form merely displays: the server takes it off the subtotal before
          the tax is worked out, so the subtotal, the tax and the total all move
          as it is typed.

          Left as a bare InputNumber rather than wrapped in MoneyInputFormItem
          because that component renders its own unnamed Form.Item - it is a
          read-only display, and has no way to carry a value into the
          submission. It gets the same moneyInput class and the same currency
          addon, so it reads as part of the same column.
        */}
        <Row gutter={[12, -5]}>
          <Col className="gutter-row" span={4} offset={15}>
            <p
              style={{
                paddingLeft: '12px',
                paddingTop: '5px',
                margin: 0,
                textAlign: 'right',
              }}
            >
              {translate('Discount')} :
            </p>
          </Col>
          <Col className="gutter-row" span={5}>
            <Form.Item name="discount" initialValue={0}>
              <InputNumber
                className="moneyInput"
                min={0}
                precision={cent_precision || 2}
                controls={false}
                style={{ width: '100%' }}
                addonBefore={currency_position === 'before' ? currency_symbol : undefined}
                addonAfter={currency_position === 'after' ? currency_symbol : undefined}
                onChange={handelDiscountChange}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, -5]}>
          <Col className="gutter-row" span={4} offset={15}>
            <Form.Item
              name="taxRate"
              rules={[
                {
                  required: true,
                },
              ]}
            >
              <SelectAsync
                value={taxRate}
                onChange={handelTaxChange}
                entity="taxes"
                outputValue="taxValue"
                displayLabels={['taxName']}
                withRedirect={true}
                urlToRedirect="/taxes"
                redirectLabel={translate('Add New Tax')}
                placeholder={translate('Select Tax Value')}
              />
            </Form.Item>
          </Col>
          <Col className="gutter-row" span={5}>
            <MoneyInputFormItem readOnly value={taxTotal} />
          </Col>
        </Row>
        <Row gutter={[12, -5]}>
          <Col className="gutter-row" span={4} offset={15}>
            <p
              style={{
                paddingLeft: '12px',
                paddingTop: '5px',
                margin: 0,
                textAlign: 'right',
              }}
            >
              {translate('Total')} :
            </p>
          </Col>
          <Col className="gutter-row" span={5}>
            <MoneyInputFormItem readOnly value={total} />
          </Col>
        </Row>
      </div>
    </>
  );
}
