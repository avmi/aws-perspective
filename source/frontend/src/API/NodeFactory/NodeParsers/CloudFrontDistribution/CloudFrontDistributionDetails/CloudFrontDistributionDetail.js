import React from 'react';
import Divider from '@material-ui/core/Divider';
import Tooltip from '@material-ui/core/Tooltip';
import { fetchImage } from '../../../../../Utils/ImageSelector';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  root: {
    // flexGrow: 1,
    display: 'grid',
    width: '100%',
    height: '100%',
    marginTop: '1vh'
  },
  list: {
    // flexGrow: 1,
    display: 'grid',
    width: '100%',
    height: '100%'
    // marginTop: '1vh',
  },
  item: {
    padding: '1vh',
    color: theme.palette.text.secondary,
    wordWrap: 'break-word',
    fontSize: '0.75rem',
    marginLeft: '1vw'
  },
  span: {
    padding: '1vh',
    wordWrap: 'break-word',
    fontSize: '0.75rem'
  },
  image: { width: 16, marginLeft: '1vw' },
  title: {
    color: 'rgba(0, 0, 0, 0.54)',
    fontSize: '1rem',
    lineHeight: '2rem',
    marginLeft: '.5rem'
  }
}));

export default ({ title, actions }) => {
  const classes = useStyles();
  const warningActions =
    actions.filter(action => action.includes('*')).length > 0;
  const badActions = actions.filter(action => action === '*').length > 0;

  function generate() {
    return (
      <React.Fragment>
        {actions.map((item, index) => {
          return (
            <Tooltip key={index} placement='top-start' title={getTitle()}>
              <div key={index}>
                <span className='resourceState'>
                  <img
                    src={fetchImage(getStatus())}
                    className={classes.image}
                  />
                  <span className={classes.span}>{item}</span>
                </span>
                <Divider key={index} className={classes.divider} />
              </div>
            </Tooltip>
          );
        })}
      </React.Fragment>
    );
  }

  // const getColor = () => {
  //   if (badActions) return '#D13212';
  //   else if (warningActions) return '#FF9900';
  //   else return '#1D8102';
  // };

  const getStatus = () => {
    if (badActions) return 'status-negative';
    else if (warningActions) return 'status-warning';
    else return 'status-available';
  };

  const getTitle = () => {
    if (badActions)
      return 'This is not secure. You should lockdown your actions by providing them in your policy';
    else if (warningActions)
      return `You could further lockdown your actions by adding the action name and removing any *'s`;
    else return 'The actions covered by this statement';
  };

  return (
    <div className={classes.root}>
      <span className={classes.title}>{title}</span>
      <div className={classes.list}>{generate()}</div>
    </div>
  );
};
