import { fetchImage } from '../../../../../Utils/ImageSelector';

const methods = ['POST', 'PUT', 'DELETE', 'PATCH', 'GET'];

export const parseAPIGatewayMethod = node => {
  try {
    return {
      styling: {
        borderStyle: 'solid',
        borderColour: '#545B64',
        borderOpacity: 0.25,
        borderSize: 1,
        message: '',
        colour: '#fff'
      },
      icon: fetchImage(getMethodType(node))
    };
  } catch (e) {
    return {};
  }
};

const getMethodType = node => {
  try {
    const type = node.properties.resourceId.split('_')[2];
    return methods.includes(type) ? type : 'AWS::ApiGateway::Method';
  } catch (e) {
    return 'AWS::ApiGateway::Method';
  }
};
